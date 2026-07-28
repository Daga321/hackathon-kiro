import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  UsernameExistsException,
  InvalidPasswordException,
  InvalidParameterException,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ok, badRequest, conflict, internalError } from '../shared/response';

const cognitoClient = new CognitoIdentityProviderClient({});
const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const USERS_TABLE = process.env.USERS_TABLE!;

interface RegisterBody {
  username: string;
  email: string;
  password: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) return badRequest('Request body is required');

    const { username, email, password } = JSON.parse(event.body) as RegisterBody;

    if (!username || !email || !password) {
      return badRequest('username, email, and password are required');
    }

    // Register user in Cognito
    const signUpResponse = await cognitoClient.send(
      new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: username,
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }],
      }),
    );

    const userId = signUpResponse.UserSub!;

    // Create user profile in DynamoDB
    await ddbClient.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: {
          userId,
          username,
          email,
          highestRound: 0,
          totalScore: 0,
          leaderboardPartition: 'GLOBAL',
          rankKey: '000000#0000000000',
          createdAt: new Date().toISOString(),
        },
      }),
    );

    return ok({
      message: 'User registered successfully.',
      userId,
    });
  } catch (error) {
    if (error instanceof UsernameExistsException) {
      return conflict('Username already exists');
    }
    if (error instanceof InvalidPasswordException) {
      return badRequest('Password does not meet requirements (min 8 chars, upper/lower/digit)');
    }
    if (error instanceof InvalidParameterException) {
      return badRequest('Invalid parameters provided');
    }
    console.error('Register error:', error);
    return internalError();
  }
};
