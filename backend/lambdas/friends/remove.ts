import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { ok, badRequest, notFound, internalError } from '../shared/response';

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const FRIENDS_TABLE = process.env.FRIENDS_TABLE!;

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    const friendId = event.pathParameters?.friendId;

    if (!friendId) return badRequest('friendId path parameter is required');

    // Verify the friendship exists
    const existing = await ddbClient.send(
      new GetCommand({
        TableName: FRIENDS_TABLE,
        Key: { userId, friendId },
      }),
    );

    if (!existing.Item) return notFound('Friendship not found');

    // Delete both sides of the relationship
    await ddbClient.send(
      new DeleteCommand({
        TableName: FRIENDS_TABLE,
        Key: { userId, friendId },
      }),
    );

    await ddbClient.send(
      new DeleteCommand({
        TableName: FRIENDS_TABLE,
        Key: { userId: friendId, friendId: userId },
      }),
    );

    return ok({ message: 'Friend removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    return internalError();
  }
};
