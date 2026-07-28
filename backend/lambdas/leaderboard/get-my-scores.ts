import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ok, internalError } from '../shared/response';

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const SCORES_TABLE = process.env.SCORES_TABLE!;

/**
 * GET /leaderboard/my-scores?limit=10
 *
 * Returns the authenticated user's top N scores (highest first).
 * Uses the user-score-gsi (PK: userId, SK: score) with ScanIndexForward=false.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    const limit = Math.min(Number(event.queryStringParameters?.limit) || 10, 50);

    const result = await ddbClient.send(
      new QueryCommand({
        TableName: SCORES_TABLE,
        IndexName: 'user-score-gsi',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        ScanIndexForward: false, // Descending order (highest score first)
        Limit: limit,
        ProjectionExpression: 'score, #r, enemiesKilled, sessionDuration, #ts',
        ExpressionAttributeNames: {
          '#r': 'round',
          '#ts': 'timestamp',
        },
      }),
    );

    const scores = (result.Items || []).map((item, index) => ({
      rank: index + 1,
      score: item.score,
      round: item.round,
      enemiesKilled: item.enemiesKilled,
      sessionDuration: item.sessionDuration,
      timestamp: item.timestamp,
    }));

    return ok({ scores });
  } catch (error) {
    console.error('Get my scores error:', error);
    return internalError();
  }
};
