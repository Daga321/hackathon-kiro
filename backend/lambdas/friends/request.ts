import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ok, badRequest, conflict, notFound, internalError } from '../shared/response';

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const FRIENDS_TABLE = process.env.FRIENDS_TABLE!;
const USERS_TABLE = process.env.USERS_TABLE!;

interface RequestBody {
  friendId: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) return badRequest('Request body is required');

    const userId = event.requestContext.authorizer?.claims?.sub;
    const { friendId } = JSON.parse(event.body) as RequestBody;

    if (!friendId) return badRequest('friendId is required');
    if (friendId === userId) return badRequest('Cannot send friend request to yourself');

    // Verify target user exists
    const targetUser = await ddbClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId: friendId },
      }),
    );

    if (!targetUser.Item) return notFound('User not found');

    // Check if relationship already exists
    const existing = await ddbClient.send(
      new GetCommand({
        TableName: FRIENDS_TABLE,
        Key: { userId, friendId },
      }),
    );

    if (existing.Item) return conflict('Friend request already exists');

    const now = new Date().toISOString();

    // Create bidirectional entries with status "pending"
    await ddbClient.send(
      new PutCommand({
        TableName: FRIENDS_TABLE,
        Item: { userId, friendId, status: 'pending', createdAt: now },
      }),
    );

    await ddbClient.send(
      new PutCommand({
        TableName: FRIENDS_TABLE,
        Item: { userId: friendId, friendId: userId, status: 'pending', createdAt: now },
      }),
    );

    return ok({ message: 'Friend request sent' });
  } catch (error) {
    console.error('Friend request error:', error);
    return internalError();
  }
};
