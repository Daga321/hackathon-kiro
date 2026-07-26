import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ok, internalError } from '../shared/response';

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const FRIENDS_TABLE = process.env.FRIENDS_TABLE!;

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub;

    const result = await ddbClient.send(
      new QueryCommand({
        TableName: FRIENDS_TABLE,
        KeyConditionExpression: 'userId = :uid',
        FilterExpression: '#status = :confirmed',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':uid': userId,
          ':confirmed': 'confirmed',
        },
      }),
    );

    return ok({ friends: result.Items || [] });
  } catch (error) {
    console.error('List friends error:', error);
    return internalError();
  }
};
