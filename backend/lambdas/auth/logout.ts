import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  GlobalSignOutCommand,
  NotAuthorizedException,
} from '@aws-sdk/client-cognito-identity-provider';
import { ok, unauthorized, internalError } from '../shared/response';

const cognitoClient = new CognitoIdentityProviderClient({});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // The access token comes from the Authorization header.
    // API Gateway Cognito Authorizer already validated it,
    // so we know it's valid at this point.
    const accessToken =
      event.headers['Authorization']?.replace('Bearer ', '') ||
      event.headers['authorization']?.replace('Bearer ', '');

    if (!accessToken) {
      return unauthorized('Access token is required');
    }

    // GlobalSignOut invalidates all tokens for this user
    await cognitoClient.send(
      new GlobalSignOutCommand({
        AccessToken: accessToken,
      }),
    );

    return ok({ message: 'Logged out successfully' });
  } catch (error) {
    if (error instanceof NotAuthorizedException) {
      return unauthorized('Token is invalid or expired');
    }
    console.error('Logout error:', error);
    return internalError();
  }
};
