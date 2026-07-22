---
inclusion: manual
---

# Guías de AWS: Horde Battle Game

## Servicios AWS y su Rol

| Servicio | Rol en el Proyecto |
|----------|-------------------|
| **Amazon Cognito User Pools** | Autenticación de usuarios, emisión de JWT (OAuth 2.0), registro y login |
| **AWS Lambda (Node.js 20)** | Lógica de negocio: submit score, leaderboard, friends, perfil |
| **Amazon API Gateway (HTTP API)** | Exposición de endpoints REST sobre HTTPS, Cognito Authorizer, CORS |
| **Amazon DynamoDB** | Persistencia de perfiles de usuario, scores y relaciones de amistad |
| **Amazon S3** | Almacenamiento de los assets estáticos compilados del frontend |
| **Amazon CloudFront** | CDN: servir el frontend con baja latencia y cacheo agresivo |
| **AWS CDK (TypeScript)** | Infraestructura como código, despliegue reproducible |
| **AWS WAF** | Protección contra ataques web (rate limiting, SQLi, XSS) |
| **Amazon Route 53** | Gestión de DNS para el dominio del juego |
| **AWS Certificate Manager (ACM)** | Certificados TLS/SSL para HTTPS (CloudFront + API Gateway) |
| **Amazon CloudWatch** | Logs, métricas, alarmas y dashboards |

---

## Amazon Cognito

### Configuración del User Pool

```typescript
// infra/lib/stacks/AuthStack.ts
import * as cognito from 'aws-cdk-lib/aws-cognito';

const userPool = new cognito.UserPool(this, 'HordeBattleUserPool', {
  userPoolName: 'horde-battle-users',
  selfSignUpEnabled: true,
  signInAliases: { email: true, username: true },
  autoVerify: { email: true },
  passwordPolicy: {
    minLength: 8,
    maxLength: 72,
    requireLowercase: true,
    requireUppercase: false,
    requireDigits: true,
    requireSymbols: false,
  },
  accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
  removalPolicy: cdk.RemovalPolicy.RETAIN, // nunca destruir en producción
});

const userPoolClient = new cognito.UserPoolClient(this, 'HordeBattleAppClient', {
  userPool,
  authFlows: {
    userPassword: true,
    userSrp: true,
  },
  oAuth: {
    flows: { authorizationCodeGrant: true },
    scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
  },
  accessTokenValidity: cdk.Duration.hours(24),
  idTokenValidity: cdk.Duration.hours(24),
  refreshTokenValidity: cdk.Duration.days(30),
  preventUserExistenceErrors: true, // evitar user enumeration
});
```

### JWT y OAuth 2.0

- Cognito emite tres tipos de tokens: **ID token**, **Access token** y **Refresh token**.
- Usar el **ID token** para identificar al usuario en el backend (contiene `sub`, `email`, `username`).
- El frontend incluye el ID token en cada petición: `Authorization: Bearer <id_token>`.
- Los tokens expiran en 24 horas; el cliente refresca automáticamente usando el Refresh token.
- **Nunca** usar el token en el frontend para decisiones de autorización; solo para enviarlo al backend.

### Extracción de Claims en Lambda

```typescript
// El Cognito Authorizer valida el JWT; los claims llegan en el requestContext
export const handler = async (event: APIGatewayProxyEvent) => {
  const claims = event.requestContext.authorizer?.claims;
  const userId = claims?.sub;           // UUID único del usuario
  const username = claims?.['cognito:username'];
  const email = claims?.email;

  if (!userId) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
  }
  // ...
};
```

### Invalidación de Sesión (Logout)

- En el backend, llamar a `AdminUserGlobalSignOut` de Cognito para invalidar todos los tokens del usuario.
- En el frontend, borrar los tokens del estado de la aplicación (no de localStorage).

```typescript
// backend/src/handlers/auth/logout.ts
import { CognitoIdentityProviderClient, AdminUserGlobalSignOutCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler = async (event: APIGatewayProxyEvent) => {
  const username = event.requestContext.authorizer?.claims?.['cognito:username'];
  await cognitoClient.send(new AdminUserGlobalSignOutCommand({
    UserPoolId: ENV.COGNITO_USER_POOL_ID,
    Username: username,
  }));
  return { statusCode: 200, body: JSON.stringify({ message: 'Logged out' }) };
};
```

---

## Amazon DynamoDB

### Diseño de Tablas

El proyecto usa el patrón **Single Table Design** con una tabla principal y tablas secundarias para rankings.

#### Tabla Principal: `horde-battle-users`

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| `PK` | String | `USER#<userId>` |
| `SK` | String | `PROFILE` / `FRIEND#<friendId>` / `SCORE#<timestamp>` |
| `username` | String | Nombre de usuario único |
| `email` | String | Email (encriptado) |
| `highestRound` | Number | Mayor ronda alcanzada |
| `totalScore` | Number | Puntuación total acumulada |
| `status` | String | `active`, `pending`, `confirmed` (para amistades) |
| `createdAt` | String | ISO 8601 |
| `updatedAt` | String | ISO 8601 |
| `GSI1PK` | String | `LEADERBOARD` (solo en entradas de score top) |
| `GSI1SK` | String | `ROUND#<pad(round)>#SCORE#<pad(score)>` (para ordenamiento) |

```typescript
// Ejemplos de ítems en la tabla
// Perfil de usuario:
{ PK: 'USER#abc123', SK: 'PROFILE', username: 'player1', highestRound: 15, totalScore: 1450 }

// Relación de amistad pendiente:
{ PK: 'USER#abc123', SK: 'FRIEND#xyz789', status: 'pending', createdAt: '...' }

// Relación de amistad confirmada (ambas partes):
{ PK: 'USER#abc123', SK: 'FRIEND#xyz789', status: 'confirmed' }
{ PK: 'USER#xyz789', SK: 'FRIEND#abc123', status: 'confirmed' }
```

#### GSI para Leaderboard Global: `GSI1`

- **GSI1PK**: `LEADERBOARD` (partition key fija para todos los scores globales)
- **GSI1SK**: `ROUND#<round_padded_6>#SCORE#<score_padded_10>` → permite scan ordenado descendente

```typescript
// Ejemplo de clave GSI para ronda 15, score 1500:
{ GSI1PK: 'LEADERBOARD', GSI1SK: 'ROUND#000015#SCORE#0000001500' }
```

#### Tabla de Usernames Únicos: `horde-battle-usernames`

Tabla auxiliar simple para verificar unicidad de usernames en O(1):

| Atributo | Tipo |
|----------|------|
| `username` | String (PK) |
| `userId` | String |

### Configuración CDK

```typescript
// infra/lib/stacks/DatabaseStack.ts
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

const usersTable = new dynamodb.Table(this, 'UsersTable', {
  tableName: 'horde-battle-users',
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // on-demand
  pointInTimeRecovery: true,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});

usersTable.addGlobalSecondaryIndex({
  indexName: 'GSI1',
  partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.INCLUDE,
  nonKeyAttributes: ['username', 'highestRound', 'totalScore', 'userId'],
});
```

### Buenas Prácticas DynamoDB

- **On-demand capacity** (`PAY_PER_REQUEST`): escala automáticamente, ideal para tráfico variable.
- **Point-in-time recovery** habilitado para todas las tablas de producción.
- **Encryption at rest** con AWS Managed Keys por defecto.
- Usar **batch writes** cuando sea posible para reducir latencia y costo.
- Limitar los scans; preferir queries con SK conditions o GSI.
- El top 100 del leaderboard global se obtiene con una Query al GSI1 con `Limit: 100` ordenado descendente.

---

## AWS Lambda

### Patrón de Handler

Ver [code-standards.md](./code-standards.md) para la estructura detallada del handler.

### Configuración de Funciones en CDK

```typescript
// infra/lib/constructs/LambdaFunction.ts
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';

export function createLambda(
  scope: Construct,
  id: string,
  entry: string,
  environment: Record<string, string>
): lambdaNodejs.NodejsFunction {
  return new lambdaNodejs.NodejsFunction(scope, id, {
    entry,
    runtime: lambda.Runtime.NODEJS_20_X,
    architecture: lambda.Architecture.ARM_64, // Graviton2: mejor precio/rendimiento
    memorySize: 256,
    timeout: cdk.Duration.seconds(10),
    environment,
    bundling: {
      minify: true,
      sourceMap: true,
      externalModules: ['@aws-sdk/*'], // incluido en el runtime de Node.js 20
    },
    tracing: lambda.Tracing.ACTIVE, // X-Ray
    logRetention: logs.RetentionDays.ONE_MONTH,
  });
}
```

### Variables de Entorno por Función

```typescript
// Ejemplo en ApiStack
const submitScoreLambda = createLambda(this, 'SubmitScoreFn',
  'src/handlers/leaderboard/submit-score.ts',
  {
    DYNAMODB_TABLE_USERS: props.usersTable.tableName,
    COGNITO_USER_POOL_ID: props.userPoolId,
    AWS_REGION: this.region,
  }
);

// Dar permisos mínimos (least privilege)
props.usersTable.grantWriteData(submitScoreLambda);
```

### Error Handling y CloudWatch Logging

- Usar una función wrapper `withErrorHandling` para capturar errores no manejados en todos los handlers.
- Los logs van automáticamente a CloudWatch Logs por el runtime de Lambda.
- Usar **structured logging** (JSON) para facilitar la búsqueda con CloudWatch Insights.
- Configurar alarmas en CloudWatch para error rate > 1% y p99 latencia > 2000ms.

```typescript
// backend/src/utils/logger.ts
export const logger = {
  info: (message: string, data?: object) =>
    console.log(JSON.stringify({ level: 'INFO', message, ...data, timestamp: new Date().toISOString() })),
  warn: (message: string, data?: object) =>
    console.warn(JSON.stringify({ level: 'WARN', message, ...data, timestamp: new Date().toISOString() })),
  error: (message: string, data?: object) =>
    console.error(JSON.stringify({ level: 'ERROR', message, ...data, timestamp: new Date().toISOString() })),
};
```

### SLA de Latencia

- El p99 de cada Lambda debe ser ≤ 2000ms bajo carga normal.
- Para reducir cold starts: usar ARM_64 (Graviton), mantener bundles pequeños, y considerar Provisioned Concurrency para endpoints críticos (login, submit score).

---

## Amazon API Gateway (HTTP API)

### Configuración

Usar **HTTP API** (no REST API) por menor latencia y costo. REST API solo si se necesitan features avanzados (request transformation, usage plans).

```typescript
// infra/lib/stacks/ApiStack.ts
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigwv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

const httpApi = new apigwv2.HttpApi(this, 'HordeBattleApi', {
  apiName: 'horde-battle-api',
  corsPreflight: {
    allowOrigins: [`https://${props.cloudFrontDomain}`], // solo el dominio de CloudFront
    allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.DELETE],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: cdk.Duration.hours(24),
  },
});

const cognitoAuthorizer = new apigwv2Authorizers.HttpUserPoolAuthorizer(
  'CognitoAuthorizer',
  props.userPool,
  { userPoolClients: [props.userPoolClient] }
);
```

### CORS

- `allowOrigins` contiene **exclusivamente** el dominio de CloudFront (no `*` en producción).
- El preflight OPTIONS es manejado automáticamente por API Gateway.
- **HTTP requests** son rechazados con 301 redirect a HTTPS (configurado en CloudFront).

### Definición de Rutas

```typescript
// Rutas protegidas (requieren JWT válido)
httpApi.addRoutes({
  path: '/leaderboard/submit',
  methods: [apigwv2.HttpMethod.POST],
  integration: new apigwv2Integrations.HttpLambdaIntegration('SubmitScore', submitScoreLambda),
  authorizer: cognitoAuthorizer,
});

httpApi.addRoutes({
  path: '/friends',
  methods: [apigwv2.HttpMethod.GET],
  integration: new apigwv2Integrations.HttpLambdaIntegration('ListFriends', listFriendsLambda),
  authorizer: cognitoAuthorizer,
});

// Ruta pública (no requiere JWT)
httpApi.addRoutes({
  path: '/leaderboard/global',
  methods: [apigwv2.HttpMethod.GET],
  integration: new apigwv2Integrations.HttpLambdaIntegration('GetGlobal', getGlobalLambda),
});
```

### Endpoints del Backend

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/auth/register` | No | Registro (Cognito lo maneja) |
| `POST` | `/auth/logout` | Sí | Invalidar sesión server-side |
| `GET` | `/leaderboard/global` | No | Top 100 global |
| `POST` | `/leaderboard/submit` | Sí | Enviar score |
| `GET` | `/leaderboard/friends` | Sí | Ranking de amigos |
| `GET` | `/friends` | Sí | Lista de amigos |
| `POST` | `/friends/request` | Sí | Enviar solicitud |
| `POST` | `/friends/accept` | Sí | Aceptar solicitud |
| `POST` | `/friends/reject` | Sí | Rechazar solicitud |
| `DELETE` | `/friends/:friendId` | Sí | Eliminar amigo |

---

## Amazon S3 + CloudFront

### Bucket S3

```typescript
// infra/lib/stacks/FrontendStack.ts
const siteBucket = new s3.Bucket(this, 'SiteBucket', {
  bucketName: `horde-battle-frontend-${this.account}`,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // acceso solo vía CloudFront OAC
  encryption: s3.BucketEncryption.S3_MANAGED,
  versioned: false, // los assets ya tienen hash en el nombre (Vite)
  removalPolicy: cdk.RemovalPolicy.RETAIN,
  autoDeleteObjects: false,
});
```

### Distribución CloudFront

```typescript
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    compress: true,
  },
  additionalBehaviors: {
    // Assets versionados (con hash en nombre): TTL máximo 1 año
    '/assets/*': {
      origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
      cachePolicy: new cloudfront.CachePolicy(this, 'ImmutableAssetPolicy', {
        defaultTtl: cdk.Duration.days(365),
        maxTtl: cdk.Duration.days(365),
        minTtl: cdk.Duration.days(365),
      }),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    },
    // index.html: sin cache (siempre fresco)
    '/index.html': {
      origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
      cachePolicy: new cloudfront.CachePolicy(this, 'NoStorePolicy', {
        defaultTtl: cdk.Duration.seconds(0),
        maxTtl: cdk.Duration.seconds(0),
        minTtl: cdk.Duration.seconds(0),
      }),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    },
  },
  defaultRootObject: 'index.html',
  errorResponses: [
    { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' }, // SPA fallback
    { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
  ],
  certificate: props.certificate, // ACM cert en us-east-1
  domainNames: [props.domainName],
  webAclId: props.wafAclArn,
  minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
});
```

### Asset Versioning

Vite genera hashes en los nombres de los bundles automáticamente (`main-Bn2xkz1A.js`). Esto permite configurar TTL extremadamente largo en CloudFront para esos assets.

### Cache Invalidation

Al desplegar una nueva versión del frontend, solo es necesario invalidar `/index.html` (ya que los demás assets tienen nombres diferentes por los hashes):

```bash
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/index.html"
```

En CDK/GitHub Actions, esto se hace automáticamente como parte del workflow de deploy.

---

## AWS CDK

### Estructura de Stacks

Dividir la infraestructura en stacks independientes para facilitar actualizaciones parciales:

```
infra/lib/stacks/
├── AuthStack.ts        # Cognito User Pool + App Client
├── DatabaseStack.ts    # DynamoDB tables + GSIs
├── ApiStack.ts         # Lambda functions + API Gateway
└── FrontendStack.ts    # S3 + CloudFront + Route53 + ACM
```

Cada stack recibe las dependencias que necesita como props:

```typescript
// infra/bin/app.ts
const app = new cdk.App();
const env = { account: process.env.CDK_ACCOUNT, region: 'us-east-1' };

const auth = new AuthStack(app, 'HordeBattleAuth', { env });
const database = new DatabaseStack(app, 'HordeBattleDatabase', { env });
const api = new ApiStack(app, 'HordeBattleApi', {
  env,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  usersTable: database.usersTable,
  usernamesTable: database.usernamesTable,
});
const frontend = new FrontendStack(app, 'HordeBattleFrontend', {
  env: { account: process.env.CDK_ACCOUNT, region: 'us-east-1' },
  apiUrl: api.apiUrl,
  domainName: 'hordebattle.example.com',
});
```

### Naming y Tagging

Todos los recursos llevan tags consistentes para facilitar el monitoreo de costos:

```typescript
cdk.Tags.of(app).add('Project', 'horde-battle-game');
cdk.Tags.of(app).add('Environment', process.env.CDK_ENV ?? 'dev');
cdk.Tags.of(app).add('ManagedBy', 'cdk');
```

Convención de nombres para recursos:
- Formato: `horde-battle-<recurso>-<entorno>`
- Ejemplos: `horde-battle-users-prod`, `horde-battle-api-dev`

---

## Servicios Adicionales

### AWS WAF

- Asociar un Web ACL a CloudFront y/o API Gateway.
- Reglas recomendadas:
  - **AWSManagedRulesCommonRuleSet**: protección general (SQLi, XSS)
  - **AWSManagedRulesAmazonIpReputationList**: bloquear IPs maliciosas conocidas
  - **Rate limiting rule**: máx. 100 requests/5min por IP en endpoints de login

```typescript
// WAF debe estar en us-east-1 para CloudFront
const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
  scope: 'CLOUDFRONT',
  defaultAction: { allow: {} },
  rules: [
    {
      name: 'AWSManagedRulesCommonRuleSet',
      priority: 1,
      overrideAction: { none: {} },
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesCommonRuleSet',
        },
      },
      visibilityConfig: { /* ... */ },
    },
  ],
  visibilityConfig: { /* ... */ },
});
```

### Route 53

- Crear un Hosted Zone para el dominio del juego.
- Añadir un **A record** (alias) apuntando a la distribución de CloudFront.
- Usar el mismo dominio para el certificado ACM.

### AWS Certificate Manager (ACM)

- Los certificados para CloudFront deben estar en **us-east-1** (requerimiento de CloudFront), independientemente de la región del resto de recursos.
- Para API Gateway custom domain (si se usa), el cert puede estar en la región de la API.

```typescript
// El stack de Frontend debe estar en us-east-1 o usar cross-region references
const certificate = new acm.Certificate(this, 'SiteCertificate', {
  domainName: 'hordebattle.example.com',
  validation: acm.CertificateValidation.fromDns(hostedZone),
});
```

### CloudWatch

#### Dashboards Recomendados

- **Gameplay**: requests a `/leaderboard/submit` por minuto, errores 4xx/5xx, latencia p50/p99
- **Auth**: intentos de login, tasa de éxito/fallo, tokens emitidos
- **Database**: consumo de RCU/WCU de DynamoDB, throttles, errores

#### Alarmas Críticas

```typescript
// Alarma: Lambda error rate > 1%
new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
  metric: submitScoreLambda.metricErrors({ period: cdk.Duration.minutes(5) }),
  threshold: 5,
  evaluationPeriods: 2,
  alarmDescription: 'Lambda submit-score con errores elevados',
});

// Alarma: DynamoDB throttle
new cloudwatch.Alarm(this, 'DynamoThrottleAlarm', {
  metric: usersTable.metricThrottledRequests({ period: cdk.Duration.minutes(5) }),
  threshold: 1,
  evaluationPeriods: 1,
  alarmDescription: 'DynamoDB throttling detectado',
});
```

---

## Costos y Buenas Prácticas de Escalado

### Estimación de Costos (Escala Moderada)

| Servicio | Costo Estimado |
|----------|---------------|
| Lambda | ~$0 (free tier: 1M requests/mes) para carga baja |
| API Gateway (HTTP API) | ~$1/millón de requests |
| DynamoDB (on-demand) | ~$1.25/millón de writes, $0.25/millón de reads |
| CloudFront | ~$0.0085/GB + $0.0075/10K requests (primeros 1TB gratis) |
| Cognito | Gratuito hasta 50,000 MAU; luego $0.0055/MAU |
| S3 | ~$0.023/GB almacenado |

### Optimizaciones de Costo

- **Lambda ARM_64 (Graviton2)**: 20% más barato que x86 con igual o mejor rendimiento.
- **DynamoDB on-demand**: sin costo de capacidad reservada ociosa; ideal para tráfico impredecible.
- **CloudFront cacheo agresivo**: reduce los requests a S3 y la latencia del usuario.
- **Lambda memory sizing**: empezar con 256MB y ajustar basado en métricas de CloudWatch (Lambda Power Tuning).
- Evitar llamadas DynamoDB innecesarias usando caché en memoria dentro del mismo Lambda (warm invocations).

### Escalado

- DynamoDB on-demand escala automáticamente sin intervención.
- Lambda escala automáticamente hasta las cuotas de cuenta (por defecto 1,000 ejecuciones concurrentes).
- Si se esperan picos de tráfico conocidos (lanzamiento, eventos), usar **Provisioned Concurrency** en las Lambdas críticas para eliminar cold starts.
- CloudFront distribuye la carga globalmente sin configuración adicional.
- Si el leaderboard global se convierte en un hotspot de lectura, considerar un TTL de caché en API Gateway (30-60 segundos) para el endpoint `GET /leaderboard/global`.
