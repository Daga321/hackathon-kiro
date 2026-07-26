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

interface RejectBody {
  friendId: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) return badRequest('Request body is required');

    const userId = event.requestContext.authorizer?.claims?.sub;
    const { friendId } = JSON.parse(event.body) as RejectBody;

    if (!friendId) return badRequest('friendId is required');

    // Verify the pending request exists
    const existing = await ddbClient.send(
      new GetCommand({
        TableName: FRIENDS_TABLE,
        Key: { userId, friendId },
      }),
    );

    if (!existing.Item) return notFound('Friend request not found');

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

    return ok({ message: 'Friend request rejected' });
  } catch (error) {
    console.error('Reject friend error:', error);
    return internalError();
  }
};
