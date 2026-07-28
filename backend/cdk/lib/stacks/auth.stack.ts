import { Stack, StackProps, CfnOutput, RemovalPolicy, Duration } from 'aws-cdk-lib';
import {
  aws_cognito as cognito,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export type AuthStackProps = StackProps;

export class AuthStack extends Stack {
  /** The Cognito User Pool — consumed by ApiStack for authorization */
  public readonly userPool: cognito.UserPool;

  /** The app client — used by the frontend to authenticate */
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: AuthStackProps) {
    super(scope, id, props);

    // ─── Cognito User Pool ─────────────────────────────────────────────────────
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ─── Pre Sign-up Lambda Trigger (auto-confirm users) ─────────────────────
    const preSignUpLambda = new nodejs.NodejsFunction(this, 'PreSignUpFunction', {
      entry: '../lambdas/auth/pre-signup.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(5),
      memorySize: 128,
    });

    this.userPool.addTrigger(cognito.UserPoolOperation.PRE_SIGN_UP, preSignUpLambda);

    // ─── App Client (frontend) ─────────────────────────────────────────────────
    this.userPoolClient = this.userPool.addClient('AppClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      preventUserExistenceErrors: true,
      accessTokenValidity: undefined,
      idTokenValidity: undefined,
    });

    // ─── Outputs ───────────────────────────────────────────────────────────────
    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito App Client ID (for frontend)',
    });

    new CfnOutput(this, 'UserPoolRegion', {
      value: this.region,
      description: 'Cognito User Pool region',
    });
  }
}
