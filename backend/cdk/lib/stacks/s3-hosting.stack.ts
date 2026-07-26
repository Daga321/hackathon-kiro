import { Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface S3HostingStackProps extends StackProps {}

/**
 * Hosts the frontend as a static website directly from S3.
 *
 * This is a lightweight alternative to StaticSiteStack (S3 + CloudFront).
 * Use this when CloudFront is unavailable (e.g. account not yet verified).
 *
 * Limitations vs CloudFront:
 * - HTTP only (no HTTPS)
 * - No CDN/edge caching
 * - Single region
 *
 * Once CloudFront is available, switch to StaticSiteStack for production.
 */
export class S3HostingStack extends Stack {
  public readonly bucketName: string;
  public readonly websiteUrl: string;

  constructor(scope: Construct, id: string, props?: S3HostingStackProps) {
    super(scope, id, props);

    // ─── S3 Bucket with Static Website Hosting ───────────────────────────────
    const bucket = new s3.Bucket(this, 'FrontendBucket', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPA fallback
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.bucketName = bucket.bucketName;
    this.websiteUrl = bucket.bucketWebsiteUrl;

    // ─── Outputs ─────────────────────────────────────────────────────────────
    new CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket name for frontend deployment (aws s3 sync)',
    });

    new CfnOutput(this, 'WebsiteUrl', {
      value: bucket.bucketWebsiteUrl,
      description: 'S3 website URL to access the frontend',
    });
  }
}
