import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ok, badRequest, notFound, internalError } from '../shared/response';

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const FRIENDS_TABLE = process.env.FRIENDS_TABLE!;

interface AcceptBody {
  friendId: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) return badRequest('Request body is required');

    const userId = event.requestContext.authorizer?.claims?.sub;
    const { friendId } = JSON.parse(event.body) as AcceptBody;

    if (!friendId) return badRequest('friendId is required');

    // Verify the pending request exists
    const existing = await ddbClient.send(
      new GetCommand({
        TableName: FRIENDS_TABLE,
        Key: { userId, friendId },
      }),
    );

    if (!existing.Item) return notFound('Friend request not found');
    if (existing.Item.status === 'confirmed') return ok({ message: 'Already friends' });

    // Update both sides to "confirmed"
    await ddbClient.send(
      new UpdateCommand({
        TableName: FRIENDS_TABLE,
        Key: { userId, friendId },
        UpdateExpression: 'SET #status = :confirmed',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':confirmed': 'confirmed' },
      }),
    );

    await ddbClient.send(
      new UpdateCommand({
        TableName: FRIENDS_TABLE,
        Key: { userId: friendId, friendId: userId },
        UpdateExpression: 'SET #status = :confirmed',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':confirmed': 'confirmed' },
      }),
    );

    return ok({ message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend error:', error);
    return internalError();
  }
};
