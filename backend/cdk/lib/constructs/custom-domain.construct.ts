import { Construct } from 'constructs';
import {
  aws_certificatemanager as acm,
  aws_route53 as route53,
} from 'aws-cdk-lib';

export interface CustomDomainProps {
  /**
   * The custom domain name (e.g., 'game.example.com')
   */
  domainName: string;

  /**
   * The Route53 hosted zone ID for the domain.
   * If provided, DNS validation records are created automatically.
   */
  hostedZoneId?: string;

  /**
   * The root domain name of the hosted zone (e.g., 'example.com').
   * Required when hostedZoneId is provided.
   */
  zoneName?: string;

  /**
   * Whether the certificate must be in us-east-1 (required for CloudFront).
   * For API Gateway regional endpoints, set to false to use the stack's region.
   * @default true
   */
  crossRegion?: boolean;
}

export class CustomDomain extends Construct {
  /**
   * The ACM certificate to attach to CloudFront or API Gateway.
   */
  public readonly certificate: acm.ICertificate;

  /**
   * The Route53 hosted zone (if resolved).
   */
  public readonly hostedZone?: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: CustomDomainProps) {
    super(scope, id);

    const { domainName, hostedZoneId, zoneName, crossRegion = true } = props;

    // Resolve hosted zone if provided
    if (hostedZoneId && zoneName) {
      this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(
        this,
        'HostedZone',
        {
          hostedZoneId,
          zoneName,
        },
      );
    }

    // Create or lookup ACM certificate
    if (crossRegion) {
      // CloudFront requires certificates in us-east-1
      this.certificate = new acm.DnsValidatedCertificate(
        this,
        'Certificate',
        {
          domainName,
          hostedZone: this.hostedZone!,
          region: 'us-east-1',
        },
      );
    } else {
      // API Gateway uses regional certificates
      this.certificate = new acm.Certificate(this, 'Certificate', {
        domainName,
        validation: this.hostedZone
          ? acm.CertificateValidation.fromDns(this.hostedZone)
          : acm.CertificateValidation.fromEmail(),
      });
    }
  }
}
