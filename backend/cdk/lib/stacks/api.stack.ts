import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import {
  aws_apigateway as apigw,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_cognito as cognito,
  aws_dynamodb as dynamodb,
  aws_route53 as route53,
  aws_route53_targets as targets,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CustomDomain } from '../constructs/custom-domain.construct';

export interface ApiStackProps extends StackProps {
  /** Cognito User Pool for request authorization */
  userPool: cognito.UserPool;

  /** DynamoDB tables map — Lambdas that need DB access receive grants */
  tables: Record<string, dynamodb.ITable>;

  /**
   * Optional custom domain for the API.
   * If not provided, API Gateway uses its default execute-api URL.
   */
  domainName?: string;
  hostedZoneId?: string;
  zoneName?: string;
}

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { userPool, tables } = props;

    // ─── Custom Domain (optional) ────────────────────────────────────────────
    let customDomain: CustomDomain | undefined;
    let apiDomainName: apigw.DomainName | undefined;

    if (props.domainName && props.hostedZoneId && props.zoneName) {
      customDomain = new CustomDomain(this, 'ApiCustomDomain', {
        domainName: props.domainName,
        hostedZoneId: props.hostedZoneId,
        zoneName: props.zoneName,
        crossRegion: false, // API Gateway uses regional certificates
      });

      apiDomainName = new apigw.DomainName(this, 'ApiDomainName', {
        domainName: props.domainName,
        certificate: customDomain.certificate,
        endpointType: apigw.EndpointType.REGIONAL,
      });
    }

    // ─── REST API ────────────────────────────────────────────────────────────
    const api = new apigw.RestApi(this, 'Api', {
      restApiName: `horde-battle-api-${this.node.id}`,
      deployOptions: {
        stageName: 'v1',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
        ],
      },
    });

    // Map custom domain to this API
    if (apiDomainName) {
      new apigw.BasePathMapping(this, 'BasePathMapping', {
        domainName: apiDomainName,
        restApi: api,
      });

      // Route53 alias record pointing to the API Gateway custom domain
      if (customDomain?.hostedZone) {
        new route53.ARecord(this, 'ApiAliasRecord', {
          zone: customDomain.hostedZone,
          recordName: props.domainName,
          target: route53.RecordTarget.fromAlias(
            new targets.ApiGatewayDomain(apiDomainName),
          ),
        });
      }
    }

    // ─── Cognito Authorizer ──────────────────────────────────────────────────
    const authorizer = new apigw.CognitoUserPoolsAuthorizer(
      this,
      'CognitoAuthorizer',
      {
        cognitoUserPools: [userPool],
        identitySource: 'method.request.header.Authorization',
      },
    );

    // ─── Lambda: Health Check ────────────────────────────────────────────────
    const healthLambda = new nodejs.NodejsFunction(this, 'HealthFunction', {
      entry: '../lambdas/health/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 128,
      environment: {
        ENVIRONMENT: process.env.ENVIRONMENT || 'dev',
      },
    });

    // Public endpoint — no auth required
    const healthResource = api.root.addResource('health');
    healthResource.addMethod(
      'GET',
      new apigw.LambdaIntegration(healthLambda),
    );

    // ─── Protected Routes (example structure) ────────────────────────────────
    // Future Lambdas will follow this pattern:
    //
    // const someLambda = new nodejs.NodejsFunction(this, 'SomeFunction', {
    //   entry: '../lambdas/some-handler/index.ts',
    //   handler: 'handler',
    //   runtime: lambda.Runtime.NODEJS_22_X,
    //   timeout: Duration.seconds(10),
    //   environment: { TABLE_NAME: tables['some-table'].tableName },
    // });
    // tables['some-table'].grantReadWriteData(someLambda);
    //
    // const someResource = api.root.addResource('some-path');
    // someResource.addMethod('GET', new apigw.LambdaIntegration(someLambda), {
    //   authorizer,
    //   authorizationType: apigw.AuthorizationType.COGNITO,
    // });

    // ─── Outputs ─────────────────────────────────────────────────────────────
    new CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL (execute-api)',
    });

    if (apiDomainName) {
      new CfnOutput(this, 'ApiCustomDomainUrl', {
        value: `https://${props.domainName}`,
        description: 'API custom domain URL',
      });
    }
  }
}
