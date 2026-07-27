import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ok, badRequest, internalError } from '../shared/response';

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const FRIENDS_TABLE = process.env.FRIENDS_TABLE!;

const VALID_STATUSES = ['confirmed', 'pending', 'all'];

/**
 * GET /friends?status=confirmed|pending|all
 *
 * Returns friend entries for the authenticated user filtered by status.
 * Defaults to "confirmed" if no status param is provided.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    const status = event.queryStringParameters?.status || 'confirmed';

    if (!VALID_STATUSES.includes(status)) {
      return badRequest('Invalid status. Use: confirmed, pending, or all');
    }

    let queryParams: Record<string, unknown>;

    if (status === 'all') {
      // No filter — return all relationships regardless of status
      queryParams = {
        TableName: FRIENDS_TABLE,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: {
          ':uid': userId,
        },
      };
    } else {
      // Filter by specific status
      queryParams = {
        TableName: FRIENDS_TABLE,
        KeyConditionExpression: 'userId = :uid',
        FilterExpression: '#status = :statusVal',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':uid': userId,
          ':statusVal': status,
        },
      };
    }

    const result = await ddbClient.send(new QueryCommand(queryParams));

    return ok({ friends: result.Items || [] });
  } catch (error) {
    console.error('List friends error:', error);
    return internalError();
  }
};
