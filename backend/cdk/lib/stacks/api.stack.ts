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

  /** Cognito User Pool Client ID — needed by auth Lambdas */
  userPoolClientId: string;

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

    const { userPool, userPoolClientId, tables } = props;

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
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key'],
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
          target: route53.RecordTarget.fromAlias(new targets.ApiGatewayDomain(apiDomainName)),
        });
      }
    }

    // ─── Cognito Authorizer ──────────────────────────────────────────────────
    // Not yet used on any route — will be referenced by future protected endpoints.
    // We attach it to the health endpoint's OPTIONS as a workaround to satisfy CDK validation,
    // but it has no effect on the actual health GET method (which remains public).
    const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
      authorizerName: 'CognitoAuthorizer',
    });
    authorizer._attachToApi(api);

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
    healthResource.addMethod('GET', new apigw.LambdaIntegration(healthLambda));

    // ─── Lambda: Auth Register ─────────────────────────────────────────────
    const registerLambda = new nodejs.NodejsFunction(this, 'RegisterFunction', {
      entry: '../lambdas/auth/register.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 128,
      environment: {
        COGNITO_CLIENT_ID: userPoolClientId,
        USERS_TABLE: tables['users'].tableName,
      },
    });
    tables['users'].grantWriteData(registerLambda);

    // ─── Lambda: Auth Login ──────────────────────────────────────────────────
    const loginLambda = new nodejs.NodejsFunction(this, 'LoginFunction', {
      entry: '../lambdas/auth/login.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 128,
      environment: {
        COGNITO_CLIENT_ID: userPoolClientId,
      },
    });

    // ─── Lambda: Auth Logout ─────────────────────────────────────────────────
    const logoutLambda = new nodejs.NodejsFunction(this, 'LogoutFunction', {
      entry: '../lambdas/auth/logout.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 128,
    });

    // ─── Auth Routes ─────────────────────────────────────────────────────────
    const authResource = api.root.addResource('auth');

    // POST /auth/register — public
    const registerResource = authResource.addResource('register');
    registerResource.addMethod('POST', new apigw.LambdaIntegration(registerLambda));

    // POST /auth/login — public
    const loginResource = authResource.addResource('login');
    loginResource.addMethod('POST', new apigw.LambdaIntegration(loginLambda));

    // POST /auth/logout — protected (requires valid JWT)
    const logoutResource = authResource.addResource('logout');
    logoutResource.addMethod('POST', new apigw.LambdaIntegration(logoutLambda), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // ─── Lambda: Friends List ────────────────────────────────────────────────
    const listFriendsLambda = new nodejs.NodejsFunction(this, 'ListFriendsFunction', {
      entry: '../lambdas/friends/list.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 128,
      environment: {
        FRIENDS_TABLE: tables['friends'].tableName,
      },
    });
    tables['friends'].grantReadData(listFriendsLambda);

    // ─── Lambda: Friends Request ─────────────────────────────────────────────
    const requestFriendLambda = new nodejs.NodejsFunction(this, 'RequestFriendFunction', {
      entry: '../lambdas/friends/request.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 128,
      environment: {
        FRIENDS_TABLE: tables['friends'].tableName,
        USERS_TABLE: tables['users'].tableName,
      },
    });
    tables['friends'].grantReadWriteData(requestFriendLambda);
    tables['users'].grantReadData(requestFriendLambda);

    // ─── Lambda: Friends Accept ──────────────────────────────────────────────
    const acceptFriendLambda = new nodejs.NodejsFunction(this, 'AcceptFriendFunction', {
      entry: '../lambdas/friends/accept.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 128,
      environment: {
        FRIENDS_TABLE: tables['friends'].tableName,
      },
    });
    tables['friends'].grantReadWriteData(acceptFriendLambda);

    // ─── Lambda: Friends Reject ──────────────────────────────────────────────
    const rejectFriendLambda = new nodejs.NodejsFunction(this, 'RejectFriendFunction', {
      entry: '../lambdas/friends/reject.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 128,
      environment: {
        FRIENDS_TABLE: tables['friends'].tableName,
      },
    });
    tables['friends'].grantReadWriteData(rejectFriendLambda);

    // ─── Lambda: Friends Remove ──────────────────────────────────────────────
    const removeFriendLambda = new nodejs.NodejsFunction(this, 'RemoveFriendFunction', {
      entry: '../lambdas/friends/remove.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 128,
      environment: {
        FRIENDS_TABLE: tables['friends'].tableName,
      },
    });
    tables['friends'].grantReadWriteData(removeFriendLambda);

    // ─── Friends Routes (all protected) ──────────────────────────────────────
    const friendsResource = api.root.addResource('friends');

    // GET /friends — list confirmed friends
    friendsResource.addMethod('GET', new apigw.LambdaIntegration(listFriendsLambda), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // POST /friends/request — send friend request
    const friendsRequestResource = friendsResource.addResource('request');
    friendsRequestResource.addMethod('POST', new apigw.LambdaIntegration(requestFriendLambda), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // POST /friends/accept — accept friend request
    const friendsAcceptResource = friendsResource.addResource('accept');
    friendsAcceptResource.addMethod('POST', new apigw.LambdaIntegration(acceptFriendLambda), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // POST /friends/reject — reject friend request
    const friendsRejectResource = friendsResource.addResource('reject');
    friendsRejectResource.addMethod('POST', new apigw.LambdaIntegration(rejectFriendLambda), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // DELETE /friends/{friendId} — remove friendship
    const friendIdResource = friendsResource.addResource('{friendId}');
    friendIdResource.addMethod('DELETE', new apigw.LambdaIntegration(removeFriendLambda), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // ─── Lambda: Leaderboard Get Global ──────────────────────────────────────
    const getGlobalLeaderboardLambda = new nodejs.NodejsFunction(
      this,
      'GetGlobalLeaderboardFunction',
      {
        entry: '../lambdas/leaderboard/get-global.ts',
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout: Duration.seconds(10),
        memorySize: 128,
        environment: {
          USERS_TABLE: tables['users'].tableName,
        },
      },
    );
    tables['users'].grantReadData(getGlobalLeaderboardLambda);

    // ─── Lambda: Leaderboard Submit Score ────────────────────────────────────
    const submitScoreLambda = new nodejs.NodejsFunction(this, 'SubmitScoreFunction', {
      entry: '../lambdas/leaderboard/submit-score.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      memorySize: 128,
      environment: {
        USERS_TABLE: tables['users'].tableName,
        SCORES_TABLE: tables['scores'].tableName,
      },
    });
    tables['users'].grantReadWriteData(submitScoreLambda);
    tables['scores'].grantWriteData(submitScoreLambda);

    // ─── Lambda: Leaderboard Get Friends ─────────────────────────────────────
    const getFriendsLeaderboardLambda = new nodejs.NodejsFunction(
      this,
      'GetFriendsLeaderboardFunction',
      {
        entry: '../lambdas/leaderboard/get-friends.ts',
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout: Duration.seconds(10),
        memorySize: 128,
        environment: {
          USERS_TABLE: tables['users'].tableName,
          FRIENDS_TABLE: tables['friends'].tableName,
        },
      },
    );
    tables['users'].grantReadData(getFriendsLeaderboardLambda);
    tables['friends'].grantReadData(getFriendsLeaderboardLambda);

    // ─── Leaderboard Routes ──────────────────────────────────────────────────
    const leaderboardResource = api.root.addResource('leaderboard');

    // GET /leaderboard/global — public (top 100)
    const globalResource = leaderboardResource.addResource('global');
    globalResource.addMethod('GET', new apigw.LambdaIntegration(getGlobalLeaderboardLambda));

    // POST /leaderboard/scores — protected (submit score after game)
    const scoresResource = leaderboardResource.addResource('scores');
    scoresResource.addMethod('POST', new apigw.LambdaIntegration(submitScoreLambda), {
      authorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // GET /leaderboard/friends — protected (friends leaderboard)
    const friendsLeaderboardResource = leaderboardResource.addResource('friends');
    friendsLeaderboardResource.addMethod(
      'GET',
      new apigw.LambdaIntegration(getFriendsLeaderboardLambda),
      { authorizer, authorizationType: apigw.AuthorizationType.COGNITO },
    );

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
