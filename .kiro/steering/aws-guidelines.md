---
inclusion: manual
---

# AWS Guidelines: Horde Battle Game

## AWS Services and Their Role

| Service | Role in the Project |
|---------|---------------------|
| **Amazon Cognito User Pools** | User authentication, JWT issuance (OAuth 2.0), registration and login |
| **AWS Lambda (Node.js 20)** | Business logic: submit score, leaderboard, friends, profile |
| **Amazon API Gateway (HTTP API)** | REST endpoint exposure over HTTPS, Cognito Authorizer, CORS |
| **Amazon DynamoDB** | Persistence of user profiles, scores, and friendship relations |
| **Amazon S3** | Storage of compiled static frontend assets |
| **Amazon CloudFront** | CDN: serve the frontend with low latency and aggressive caching |
| **AWS CDK (TypeScript)** | Infrastructure as code, reproducible deployment |
| **AWS WAF** | Web attack protection (rate limiting, SQLi, XSS) |
| **Amazon Route 53** | DNS management for the game domain |
| **AWS Certificate Manager (ACM)** | TLS/SSL certificates for HTTPS (CloudFront + API Gateway) |
| **Amazon CloudWatch** | Logs, metrics, alarms, and dashboards |

---

## Amazon Cognito

### User Pool Configuration

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
  removalPolicy: cdk.RemovalPolicy.RETAIN, // never destroy in production
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
  preventUserExistenceErrors: true, // prevent user enumeration
});
```

### JWT and OAuth 2.0

- Cognito issues three types of tokens: **ID token**, **Access token**, and **Refresh token**.
- Use the **ID token** to identify the user in the backend (contains `sub`, `email`, `username`).
- The frontend includes the ID token in each request: `Authorization: Bearer <id_token>`.
- Tokens expire in 24 hours; the client automatically refreshes using the Refresh token.
- **Never** use the token on the frontend for authorization decisions; only to send it to the backend.

### Extracting Claims in Lambda

```typescript
// The Cognito Authorizer validates the JWT; claims arrive in the requestContext
export const handler = async (event: APIGatewayProxyEvent) => {
  const claims = event.requestContext.authorizer?.claims;
  const userId = claims?.sub;           // User's unique UUID
  const username = claims?.['cognito:username'];
  const email = claims?.email;

  if (!userId) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
  }
  // ...
};
```

### Session Invalidation (Logout)

- On the backend, call Cognito's `AdminUserGlobalSignOut` to invalidate all of the user's tokens.
- On the frontend, clear tokens from application state (not from localStorage).

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

### Table Design

The project uses a **Single Table Design** pattern with one main table and secondary tables for rankings.

#### Main Table: `horde-battle-users`

| Attribute | Type | Description |
|-----------|------|-------------|
| `PK` | String | `USER#<userId>` |
| `SK` | String | `PROFILE` / `FRIEND#<friendId>` / `SCORE#<timestamp>` |
| `username` | String | Unique username |
| `email` | String | Email (encrypted) |
| `highestRound` | Number | Highest round reached |
| `totalScore` | Number | Total accumulated score |
| `status` | String | `active`, `pending`, `confirmed` (for friendships) |
| `createdAt` | String | ISO 8601 |
| `updatedAt` | String | ISO 8601 |
| `GSI1PK` | String | `LEADERBOARD` (only on top score entries) |
| `GSI1SK` | String | `ROUND#<pad(round)>#SCORE#<pad(score)>` (for sorting) |

```typescript
// Example items in the table
// User profile:
{ PK: 'USER#abc123', SK: 'PROFILE', username: 'player1', highestRound: 15, totalScore: 1450 }

// Pending friendship relation:
{ PK: 'USER#abc123', SK: 'FRIEND#xyz789', status: 'pending', createdAt: '...' }

// Confirmed friendship relation (both sides):
{ PK: 'USER#abc123', SK: 'FRIEND#xyz789', status: 'confirmed' }
{ PK: 'USER#xyz789', SK: 'FRIEND#abc123', status: 'confirmed' }
```

#### GSI for Global Leaderboard: `GSI1`

- **GSI1PK**: `LEADERBOARD` (fixed partition key for all global scores)
- **GSI1SK**: `ROUND#<round_padded_6>#SCORE#<score_padded_10>` → allows descending ordered scan

```typescript
// GSI key example for round 15, score 1500:
{ GSI1PK: 'LEADERBOARD', GSI1SK: 'ROUND#000015#SCORE#0000001500' }
```

#### Unique Usernames Table: `horde-battle-usernames`

Simple auxiliary table to verify username uniqueness in O(1):

| Attribute | Type |
|-----------|------|
| `username` | String (PK) |
| `userId` | String |

### CDK Configuration

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

### DynamoDB Best Practices

- **On-demand capacity** (`PAY_PER_REQUEST`): scales automatically, ideal for variable traffic.
- **Point-in-time recovery** enabled for all production tables.
- **Encryption at rest** with AWS Managed Keys by default.
- Use **batch writes** when possible to reduce latency and cost.
- Limit scans; prefer queries with SK conditions or GSI.
- The global leaderboard top 100 is obtained with a Query on GSI1 with `Limit: 100` sorted descending.

---

## AWS Lambda

### Handler Pattern

See [code-standards.md](./code-standards.md) for the detailed handler structure.

### Function Configuration in CDK

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
    architecture: lambda.Architecture.ARM_64, // Graviton2: better price/performance
    memorySize: 256,
    timeout: cdk.Duration.seconds(10),
    environment,
    bundling: {
      minify: true,
      sourceMap: true,
      externalModules: ['@aws-sdk/*'], // included in the Node.js 20 runtime
    },
    tracing: lambda.Tracing.ACTIVE, // X-Ray
    logRetention: logs.RetentionDays.ONE_MONTH,
  });
}
```

### Environment Variables Per Function

```typescript
// Example in ApiStack
const submitScoreLambda = createLambda(this, 'SubmitScoreFn',
  'src/handlers/leaderboard/submit-score.ts',
  {
    DYNAMODB_TABLE_USERS: props.usersTable.tableName,
    COGNITO_USER_POOL_ID: props.userPoolId,
    AWS_REGION: this.region,
  }
);

// Grant minimum permissions (least privilege)
props.usersTable.grantWriteData(submitScoreLambda);
```

### Error Handling and CloudWatch Logging

- Use a `withErrorHandling` wrapper function to catch unhandled errors in all handlers.
- Logs go automatically to CloudWatch Logs via the Lambda runtime.
- Use **structured logging** (JSON) to facilitate searching with CloudWatch Insights.
- Configure CloudWatch alarms for error rate > 1% and p99 latency > 2000ms.

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

### Latency SLA

- The p99 of each Lambda must be ≤ 2000ms under normal load.
- To reduce cold starts: use ARM_64 (Graviton), keep bundles small, and consider Provisioned Concurrency for critical endpoints (login, submit score).

---

## Amazon API Gateway (HTTP API)

### Configuration

Use **HTTP API** (not REST API) for lower latency and cost. REST API only if advanced features are needed (request transformation, usage plans).

```typescript
// infra/lib/stacks/ApiStack.ts
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigwv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

const httpApi = new apigwv2.HttpApi(this, 'HordeBattleApi', {
  apiName: 'horde-battle-api',
  corsPreflight: {
    allowOrigins: [`https://${props.cloudFrontDomain}`], // only the CloudFront domain
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

- `allowOrigins` contains **exclusively** the CloudFront domain (not `*` in production).
- The preflight OPTIONS is handled automatically by API Gateway.
- **HTTP requests** are rejected with a 301 redirect to HTTPS (configured in CloudFront).

### Route Definitions

```typescript
// Protected routes (require valid JWT)
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

// Public route (no JWT required)
httpApi.addRoutes({
  path: '/leaderboard/global',
  methods: [apigwv2.HttpMethod.GET],
  integration: new apigwv2Integrations.HttpLambdaIntegration('GetGlobal', getGlobalLambda),
});
```

### Backend Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | No | Registration (Cognito handles it) |
| `POST` | `/auth/logout` | Yes | Invalidate session server-side |
| `GET` | `/leaderboard/global` | No | Global top 100 |
| `POST` | `/leaderboard/submit` | Yes | Submit score |
| `GET` | `/leaderboard/friends` | Yes | Friend ranking |
| `GET` | `/friends` | Yes | Friend list |
| `POST` | `/friends/request` | Yes | Send request |
| `POST` | `/friends/accept` | Yes | Accept request |
| `POST` | `/friends/reject` | Yes | Reject request |
| `DELETE` | `/friends/:friendId` | Yes | Remove friend |

---

## Amazon S3 + CloudFront

### S3 Bucket

```typescript
// infra/lib/stacks/FrontendStack.ts
const siteBucket = new s3.Bucket(this, 'SiteBucket', {
  bucketName: `horde-battle-frontend-${this.account}`,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // access only via CloudFront OAC
  encryption: s3.BucketEncryption.S3_MANAGED,
  versioned: false, // assets already have hash in the name (Vite)
  removalPolicy: cdk.RemovalPolicy.RETAIN,
  autoDeleteObjects: false,
});
```

### CloudFront Distribution

```typescript
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    compress: true,
  },
  additionalBehaviors: {
    // Versioned assets (with hash in name): maximum TTL 1 year
    '/assets/*': {
      origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
      cachePolicy: new cloudfront.CachePolicy(this, 'ImmutableAssetPolicy', {
        defaultTtl: cdk.Duration.days(365),
        maxTtl: cdk.Duration.days(365),
        minTtl: cdk.Duration.days(365),
      }),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    },
    // index.html: no cache (always fresh)
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
  certificate: props.certificate, // ACM cert in us-east-1
  domainNames: [props.domainName],
  webAclId: props.wafAclArn,
  minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
});
```

### Asset Versioning

Vite automatically generates hashes in bundle names (`main-Bn2xkz1A.js`). This allows configuring extremely long TTL in CloudFront for those assets.

### Cache Invalidation

When deploying a new frontend version, only `/index.html` needs to be invalidated (since other assets have different names due to hashes):

```bash
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/index.html"
```

In CDK/GitHub Actions, this is done automatically as part of the deploy workflow.

---

## AWS CDK

### Stack Structure

Split infrastructure into independent stacks to facilitate partial updates:

```
infra/lib/stacks/
├── AuthStack.ts        # Cognito User Pool + App Client
├── DatabaseStack.ts    # DynamoDB tables + GSIs
├── ApiStack.ts         # Lambda functions + API Gateway
└── FrontendStack.ts    # S3 + CloudFront + Route53 + ACM
```

Each stack receives the dependencies it needs as props:

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

### Naming and Tagging

All resources carry consistent tags to facilitate cost monitoring:

```typescript
cdk.Tags.of(app).add('Project', 'horde-battle-game');
cdk.Tags.of(app).add('Environment', process.env.CDK_ENV ?? 'dev');
cdk.Tags.of(app).add('ManagedBy', 'cdk');
```

Resource naming convention:
- Format: `horde-battle-<resource>-<environment>`
- Examples: `horde-battle-users-prod`, `horde-battle-api-dev`

---

## Additional Services

### AWS WAF

- Associate a Web ACL with CloudFront and/or API Gateway.
- Recommended rules:
  - **AWSManagedRulesCommonRuleSet**: general protection (SQLi, XSS)
  - **AWSManagedRulesAmazonIpReputationList**: block known malicious IPs
  - **Rate limiting rule**: max 100 requests/5min per IP on login endpoints

```typescript
// WAF must be in us-east-1 for CloudFront
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

- Create a Hosted Zone for the game domain.
- Add an **A record** (alias) pointing to the CloudFront distribution.
- Use the same domain for the ACM certificate.

### AWS Certificate Manager (ACM)

- Certificates for CloudFront must be in **us-east-1** (CloudFront requirement), regardless of the region of other resources.
- For API Gateway custom domain (if used), the cert can be in the API's region.

```typescript
// The Frontend stack must be in us-east-1 or use cross-region references
const certificate = new acm.Certificate(this, 'SiteCertificate', {
  domainName: 'hordebattle.example.com',
  validation: acm.CertificateValidation.fromDns(hostedZone),
});
```

### CloudWatch

#### Recommended Dashboards

- **Gameplay**: requests to `/leaderboard/submit` per minute, 4xx/5xx errors, p50/p99 latency
- **Auth**: login attempts, success/failure rate, tokens issued
- **Database**: DynamoDB RCU/WCU consumption, throttles, errors

#### Critical Alarms

```typescript
// Alarm: Lambda error rate > 1%
new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
  metric: submitScoreLambda.metricErrors({ period: cdk.Duration.minutes(5) }),
  threshold: 5,
  evaluationPeriods: 2,
  alarmDescription: 'Lambda submit-score with elevated errors',
});

// Alarm: DynamoDB throttle
new cloudwatch.Alarm(this, 'DynamoThrottleAlarm', {
  metric: usersTable.metricThrottledRequests({ period: cdk.Duration.minutes(5) }),
  threshold: 1,
  evaluationPeriods: 1,
  alarmDescription: 'DynamoDB throttling detected',
});
```

---

## Costs and Scaling Best Practices

### Cost Estimation (Moderate Scale)

| Service | Estimated Cost |
|---------|---------------|
| Lambda | ~$0 (free tier: 1M requests/month) for low load |
| API Gateway (HTTP API) | ~$1/million requests |
| DynamoDB (on-demand) | ~$1.25/million writes, $0.25/million reads |
| CloudFront | ~$0.0085/GB + $0.0075/10K requests (first 1TB free) |
| Cognito | Free up to 50,000 MAU; then $0.0055/MAU |
| S3 | ~$0.023/GB stored |

### Cost Optimizations

- **Lambda ARM_64 (Graviton2)**: 20% cheaper than x86 with equal or better performance.
- **DynamoDB on-demand**: no idle reserved capacity cost; ideal for unpredictable traffic.
- **CloudFront aggressive caching**: reduces requests to S3 and user latency.
- **Lambda memory sizing**: start with 256MB and adjust based on CloudWatch metrics (Lambda Power Tuning).
- Avoid unnecessary DynamoDB calls by using in-memory cache within the same Lambda (warm invocations).

### Scaling

- DynamoDB on-demand scales automatically without intervention.
- Lambda scales automatically up to account quotas (default 1,000 concurrent executions).
- If known traffic spikes are expected (launch, events), use **Provisioned Concurrency** on critical Lambdas to eliminate cold starts.
- CloudFront distributes load globally without additional configuration.
- If the global leaderboard becomes a read hotspot, consider a cache TTL in API Gateway (30-60 seconds) for the `GET /leaderboard/global` endpoint.
