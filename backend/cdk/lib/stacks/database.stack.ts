import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends StackProps {}

export class DatabaseStack extends Stack {
  /**
   * Map of table name → DynamoDB Table reference.
   * Consumed by ApiStack to grant Lambda functions read/write access.
   *
   * Keys: 'users' | 'scores' | 'friends'
   */
  public readonly tables: Record<string, dynamodb.ITable>;

  constructor(scope: Construct, id: string, props?: DatabaseStackProps) {
    super(scope, id, props);

    this.tables = {};

    // ─── Users Table ───────────────────────────────────────────────────────────
    // Stores player profiles and stats.
    // PK: userId (Cognito sub)
    //
    // Attributes:
    //   username, email, highestRound, totalScore, createdAt,
    //   leaderboardPartition ("GLOBAL"), rankKey (padded for sort)
    //
    // GSI: leaderboard-gsi
    //   Enables top-N queries without scanning.
    //   PK: leaderboardPartition (always "GLOBAL")
    //   SK: rankKey (descending sort via ScanIndexForward=false)
    //   The Lambda queries this GSI — DynamoDB keeps it synced automatically.
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    usersTable.addGlobalSecondaryIndex({
      indexName: 'leaderboard-gsi',
      partitionKey: {
        name: 'leaderboardPartition',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'rankKey',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.tables['users'] = usersTable;

    // ─── Scores Table ──────────────────────────────────────────────────────────
    // Stores individual game session results (history).
    // PK: userId (Cognito sub)
    // SK: timestamp (ISO 8601 with ms — ensures uniqueness per session)
    //
    // Attributes:
    //   round, score, enemiesKilled, sessionDuration
    //
    // Access patterns:
    //   - Get all scores for a user (sorted by time desc)
    //   - Get latest N scores for a user
    const scoresTable = new dynamodb.Table(this, 'ScoresTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.tables['scores'] = scoresTable;

    // ─── Friends Table ─────────────────────────────────────────────────────────
    // Stores friendship relationships between players.
    // PK: userId (who initiated or owns this side of the relationship)
    // SK: friendId (the other user)
    //
    // Attributes:
    //   status ("pending" | "confirmed"), createdAt
    //
    // Bidirectional: when A befriends B, two items are written:
    //   { userId: A, friendId: B, status: "pending" }
    //   { userId: B, friendId: A, status: "pending" }
    // On accept, both are updated to status: "confirmed"
    //
    // Access patterns:
    //   - Get all friends for a user (filter by status=confirmed)
    //   - Get pending friend requests for a user (filter by status=pending)
    //   - Check if two users are friends (GetItem by PK+SK)
    const friendsTable = new dynamodb.Table(this, 'FriendsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'friendId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.tables['friends'] = friendsTable;

    // ─── Outputs ───────────────────────────────────────────────────────────────
    new CfnOutput(this, 'UsersTableName', {
      value: usersTable.tableName,
      description: 'DynamoDB Users table name',
    });

    new CfnOutput(this, 'ScoresTableName', {
      value: scoresTable.tableName,
      description: 'DynamoDB Scores table name',
    });

    new CfnOutput(this, 'FriendsTableName', {
      value: friendsTable.tableName,
      description: 'DynamoDB Friends table name',
    });
  }
}
