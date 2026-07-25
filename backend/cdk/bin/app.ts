import 'dotenv/config';
import { App } from 'aws-cdk-lib';
import { StaticSiteStack } from '../lib/stacks/static-site.stack';
import { AuthStack } from '../lib/stacks/auth.stack';
import { DatabaseStack } from '../lib/stacks/database.stack';
import { ApiStack } from '../lib/stacks/api.stack';

const app = new App();

const environment = process.env.ENVIRONMENT;
const region = process.env.AWS_DEFAULT_REGION;
const account = process.env.AWS_ACCOUNT_ID;

const env = { region, account };
const suffix = `-${environment}`;

// ─── Static Site (S3 + CloudFront) ───────────────────────────────────────────
new StaticSiteStack(app, `StaticSiteStack${suffix}`, {
  env,
  // Custom domain — uncomment when ready:
  // domainName: process.env.DOMAIN_NAME,
  // hostedZoneId: process.env.HOSTED_ZONE_ID,
  // zoneName: process.env.ZONE_NAME,
});

// ─── Auth (Cognito) ──────────────────────────────────────────────────────────
const auth = new AuthStack(app, `AuthStack${suffix}`, { env });

// ─── Database (DynamoDB) ─────────────────────────────────────────────────────
const database = new DatabaseStack(app, `DatabaseStack${suffix}`, { env });

// ─── API (API Gateway + Lambda) ──────────────────────────────────────────────
new ApiStack(app, `ApiStack${suffix}`, {
  env,
  userPool: auth.userPool,
  tables: database.tables,
  // Custom domain — uncomment when ready:
  // domainName: process.env.API_DOMAIN_NAME,
  // hostedZoneId: process.env.HOSTED_ZONE_ID,
  // zoneName: process.env.ZONE_NAME,
});

app.synth();
