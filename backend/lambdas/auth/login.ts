import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  NotAuthorizedException,
  UserNotFoundException,
  UserNotConfirmedException,
} from '@aws-sdk/client-cognito-identity-provider';
import { ok, badRequest, unauthorized, internalError } from '../shared/response';

const cognitoClient = new CognitoIdentityProviderClient({});

const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

interface LoginBody {
  username: string;
  password: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) return badRequest('Request body is required');

    const { username, password } = JSON.parse(event.body) as LoginBody;

    if (!username || !password) {
      return badRequest('username and password are required');
    }

    const authResponse = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      }),
    );

    const result = authResponse.AuthenticationResult;

    if (!result) {
      return unauthorized('Authentication failed');
    }

    return ok({
      accessToken: result.AccessToken,
      idToken: result.IdToken,
      refreshToken: result.RefreshToken,
      expiresIn: result.ExpiresIn,
    });
  } catch (error) {
    if (error instanceof NotAuthorizedException) {
      return unauthorized('Invalid username or password');
    }
    if (error instanceof UserNotFoundException) {
      return unauthorized('Invalid username or password');
    }
    if (error instanceof UserNotConfirmedException) {
      return unauthorized('Email not verified. Please confirm your email first.');
    }
    console.error('Login error:', error);
    return internalError();
  }
};
