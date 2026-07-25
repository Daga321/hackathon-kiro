import { Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import {
  aws_s3 as s3,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_route53 as route53,
  aws_route53_targets as targets,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CustomDomain } from '../constructs/custom-domain.construct';

export interface StaticSiteStackProps extends StackProps {
  /**
   * Optional custom domain configuration.
   * If not provided, CloudFront uses its default *.cloudfront.net URL.
   */
  domainName?: string;
  hostedZoneId?: string;
  zoneName?: string;
}

export class StaticSiteStack extends Stack {
  /** The S3 bucket name — used by GitHub Actions for `aws s3 sync` */
  public readonly bucketName: string;

  /** The CloudFront distribution ID — used by GitHub Actions for cache invalidation */
  public readonly distributionId: string;

  constructor(scope: Construct, id: string, props?: StaticSiteStackProps) {
    super(scope, id, props);

    // ─── S3 Bucket ───────────────────────────────────────────────────────────────
    const bucket = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // ─── Custom Domain (optional) ────────────────────────────────────────────────
    let customDomain: CustomDomain | undefined;

    if (props?.domainName && props.hostedZoneId && props.zoneName) {
      customDomain = new CustomDomain(this, 'CustomDomain', {
        domainName: props.domainName,
        hostedZoneId: props.hostedZoneId,
        zoneName: props.zoneName,
        crossRegion: true, // CloudFront requires us-east-1 certs
      });
    }

    // ─── CloudFront Distribution ─────────────────────────────────────────────────
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      defaultRootObject: 'index.html',
      // SPA/Phaser: any route that doesn't match a file returns index.html
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      // Custom domain config — only applied when domainName is provided
      ...(customDomain && {
        domainNames: [props!.domainName!],
        certificate: customDomain.certificate,
      }),
    });

    // ─── Route53 Alias Record (only with custom domain) ──────────────────────────
    if (customDomain?.hostedZone) {
      new route53.ARecord(this, 'AliasRecord', {
        zone: customDomain.hostedZone,
        recordName: props!.domainName,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(distribution),
        ),
      });
    }

    // ─── Outputs for GitHub Actions ──────────────────────────────────────────────
    this.bucketName = bucket.bucketName;
    this.distributionId = distribution.distributionId;

    new CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket name for frontend deployment (aws s3 sync)',
    });

    new CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description:
        'CloudFront distribution ID for cache invalidation',
    });

    new CfnOutput(this, 'DistributionUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront URL to access the frontend',
    });
  }
}
