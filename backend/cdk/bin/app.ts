import { config } from 'dotenv';
import { resolve } from 'path';
import { App } from 'aws-cdk-lib';
// import { StaticSiteStack } from '../lib/stacks/static-site.stack'; // DISABLED: pending CloudFront verification
import { S3HostingStack } from '../lib/stacks/s3-hosting.stack';
import { AuthStack } from '../lib/stacks/auth.stack';
import { DatabaseStack } from '../lib/stacks/database.stack';
import { ApiStack } from '../lib/stacks/api.stack';

// Load .env from project root
config({ path: resolve(__dirname, '..', '..', '..', '.env') });

const app = new App();

const environment = process.env.ENVIRONMENT || 'dev';
const region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
const account = process.env.AWS_ACCOUNT_ID;

const env = { region, account };
const suffix = `-${environment}`;

// ─── Static Site (S3 + CloudFront) ───────────────────────────────────────────
// TEMPORARILY DISABLED: CloudFront requires account verification.
// Uncomment once AWS Support enables CloudFront on this account.
// new StaticSiteStack(app, `StaticSiteStack${suffix}`, {
//   env,
//   // domainName: process.env.DOMAIN_NAME,
//   // hostedZoneId: process.env.HOSTED_ZONE_ID,
//   // zoneName: process.env.ZONE_NAME,
// });

// ─── S3 Hosting (temporary, no CloudFront) ───────────────────────────────────
new S3HostingStack(app, `S3HostingStack${suffix}`, { env });

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
