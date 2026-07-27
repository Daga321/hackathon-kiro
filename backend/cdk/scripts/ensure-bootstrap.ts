/**
 * Checks if CDK bootstrap has been run for the current account/region.
 * If not, runs it automatically before proceeding with deploy.
 *
 * How it works:
 * - CDK bootstrap creates an SSM parameter `/cdk-bootstrap/hnb659fds/version`
 * - We check if that parameter exists
 * - If it doesn't, we run `cdk bootstrap`
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { execSync } from 'child_process';

// Load .env from project root
config({ path: resolve(__dirname, '..', '..', '..', '.env') });

const region = process.env.AWS_DEFAULT_REGION;
const account = process.env.AWS_ACCOUNT_ID;

if (!account) {
  console.error('ERROR: AWS_ACCOUNT_ID is not set in your .env file.');
  process.exit(1);
}

console.log(`Checking CDK bootstrap for account ${account} in ${region}...`);

try {
  // Try to read the SSM parameter that bootstrap creates
  execSync(`aws ssm get-parameter --name "/cdk-bootstrap/hnb659fds/version" --region ${region}`, {
    stdio: 'pipe',
  });
  console.log('Bootstrap already exists. Proceeding with deploy.');
} catch {
  console.log('Bootstrap not found. Running cdk bootstrap...');
  try {
    execSync(`npx cdk bootstrap aws://${account}/${region}`, {
      stdio: 'inherit',
      cwd: __dirname + '/..',
    });
    console.log('Bootstrap completed successfully.');
  } catch {
    console.error('Bootstrap failed. Check your AWS credentials and permissions.');
    process.exit(1);
  }
}
