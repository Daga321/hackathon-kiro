import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ok, badRequest, internalError } from '../shared/response';

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const USERS_TABLE = process.env.USERS_TABLE!;
const SCORES_TABLE = process.env.SCORES_TABLE!;

interface SubmitScoreBody {
  round: number;
  score: number;
  enemiesKilled: number;
  sessionDuration: number;
}

/**
 * Generates a padded rankKey for DynamoDB sort.
 * Format: "RRRRRR#SSSSSSSSSS" (6-digit round + 10-digit score)
 * Higher values sort last alphabetically, so we query with ScanIndexForward=false.
 */
function generateRankKey(highestRound: number, totalScore: number): string {
  const roundPadded = String(highestRound).padStart(6, '0');
  const scorePadded = String(totalScore).padStart(10, '0');
  return `${roundPadded}#${scorePadded}`;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) return badRequest('Request body is required');

    const userId = event.requestContext.authorizer?.claims?.sub;
    const { round, score, enemiesKilled, sessionDuration } = JSON.parse(
      event.body,
    ) as SubmitScoreBody;

    if (round == null || score == null || enemiesKilled == null || sessionDuration == null) {
      return badRequest('round, score, enemiesKilled, and sessionDuration are required');
    }

    const timestamp = new Date().toISOString();

    // 1. Save score to scores table (history)
    await ddbClient.send(
      new PutCommand({
        TableName: SCORES_TABLE,
        Item: { userId, timestamp, round, score, enemiesKilled, sessionDuration },
      }),
    );

    // 2. Get current user profile to compare stats
    const userResult = await ddbClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId },
      }),
    );

    const currentProfile = userResult.Item;
    const currentHighestRound = currentProfile?.highestRound || 0;
    const currentTotalScore = currentProfile?.totalScore || 0;

    // 3. Update user profile if new high score
    const newHighestRound = Math.max(currentHighestRound, round);
    const newTotalScore = currentTotalScore + score;
    const newRankKey = generateRankKey(newHighestRound, newTotalScore);

    await ddbClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: 'SET highestRound = :hr, totalScore = :ts, rankKey = :rk',
        ExpressionAttributeValues: {
          ':hr': newHighestRound,
          ':ts': newTotalScore,
          ':rk': newRankKey,
        },
      }),
    );

    return ok({
      message: 'Score submitted',
      highestRound: newHighestRound,
      totalScore: newTotalScore,
    });
  } catch (error) {
    console.error('Submit score error:', error);
    return internalError();
  }
};
