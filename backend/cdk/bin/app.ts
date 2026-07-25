import 'dotenv/config';
import { App } from 'aws-cdk-lib';

const app = new App();

const environment = process.env.ENVIRONMENT;
const region = process.env.AWS_DEFAULT_REGION;
const account = process.env.AWS_ACCOUNT_ID;

const env = { region, account };
const suffix = `-${environment}`;

// Stacks will be instantiated here as they are implemented
// Example:
// new AuthStack(app, `AuthStack${suffix}`, { env });
// new DatabaseStack(app, `DatabaseStack${suffix}`, { env });
// new LambdaStack(app, `LambdaStack${suffix}`, { env, tables: database.tables });
// new ApiStack(app, `ApiStack${suffix}`, { env, lambdas: lambdas.functions, userPool: auth.userPool });

app.synth();
