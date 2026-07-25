import { Stack, StackProps } from 'aws-cdk-lib';
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends StackProps {}

export class DatabaseStack extends Stack {
  /**
   * Map of table name → DynamoDB Table reference.
   * Consumed by ApiStack to grant Lambda functions read/write access.
   *
   * Tables will be defined in a follow-up commit once the data model is finalized.
   */
  public readonly tables: Record<string, dynamodb.ITable>;

  constructor(scope: Construct, id: string, props?: DatabaseStackProps) {
    super(scope, id, props);

    this.tables = {};

    // ─── Tables ────────────────────────────────────────────────────────────────
    // TODO: Define DynamoDB tables here once the data model is agreed upon.
    // Each table should be added to this.tables so ApiStack can reference them.
    //
    // Example:
    // const usersTable = new dynamodb.Table(this, 'UsersTable', {
    //   partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    //   billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    //   removalPolicy: RemovalPolicy.DESTROY,
    // });
    // this.tables['users'] = usersTable;
  }
}
