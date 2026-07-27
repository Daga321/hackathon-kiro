import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ok, internalError } from '../shared/response';

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const USERS_TABLE = process.env.USERS_TABLE!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const limit = Math.min(Number(event.queryStringParameters?.limit) || 100, 100);

    const result = await ddbClient.send(
      new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: 'leaderboard-gsi',
        KeyConditionExpression: 'leaderboardPartition = :global',
        ExpressionAttributeValues: { ':global': 'GLOBAL' },
        ScanIndexForward: false, // Descending order (highest rank first)
        Limit: limit,
        ProjectionExpression: 'userId, username, highestRound, totalScore',
      }),
    );

    const leaderboard = (result.Items || []).map((item, index) => ({
      rank: index + 1,
      userId: item.userId,
      username: item.username,
      highestRound: item.highestRound,
      totalScore: item.totalScore,
    }));

    return ok({ leaderboard });
  } catch (error) {
    console.error('Get global leaderboard error:', error);
    return internalError();
  }
};
