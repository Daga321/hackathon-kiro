import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { ok, internalError } from '../shared/response';

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const USERS_TABLE = process.env.USERS_TABLE!;
const FRIENDS_TABLE = process.env.FRIENDS_TABLE!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub;

    // 1. Get confirmed friends list
    const friendsResult = await ddbClient.send(
      new QueryCommand({
        TableName: FRIENDS_TABLE,
        KeyConditionExpression: 'userId = :uid',
        FilterExpression: '#status = :confirmed',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':uid': userId,
          ':confirmed': 'confirmed',
        },
        ProjectionExpression: 'friendId',
      }),
    );

    const friendIds = (friendsResult.Items || []).map((item) => item.friendId);

    // Include the user themselves in the leaderboard
    const allUserIds = [userId, ...friendIds];

    if (allUserIds.length === 0) {
      return ok({ leaderboard: [] });
    }

    // 2. Batch get user profiles for all friends + self
    // DynamoDB BatchGet supports max 100 items per request
    const batchSize = 100;
    const allProfiles: Record<string, unknown>[] = [];

    for (let i = 0; i < allUserIds.length; i += batchSize) {
      const batch = allUserIds.slice(i, i + batchSize);

      const batchResult = await ddbClient.send(
        new BatchGetCommand({
          RequestItems: {
            [USERS_TABLE]: {
              Keys: batch.map((id) => ({ userId: id })),
              ProjectionExpression: 'userId, username, highestRound, totalScore',
            },
          },
        }),
      );

      const responses = batchResult.Responses?.[USERS_TABLE] || [];
      allProfiles.push(...responses);
    }

    // 3. Sort by highestRound desc, then totalScore desc
    allProfiles.sort((a, b) => {
      const roundDiff = (b.highestRound as number) - (a.highestRound as number);
      if (roundDiff !== 0) return roundDiff;
      return (b.totalScore as number) - (a.totalScore as number);
    });

    const leaderboard = allProfiles.map((item, index) => ({
      rank: index + 1,
      userId: item.userId,
      username: item.username,
      highestRound: item.highestRound,
      totalScore: item.totalScore,
    }));

    return ok({ leaderboard });
  } catch (error) {
    console.error('Get friends leaderboard error:', error);
    return internalError();
  }
};
