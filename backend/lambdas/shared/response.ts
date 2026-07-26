import { APIGatewayProxyResult } from 'aws-lambda';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export function ok(data: unknown): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify(data),
  };
}

export function created(data: unknown): APIGatewayProxyResult {
  return {
    statusCode: 201,
    headers: HEADERS,
    body: JSON.stringify(data),
  };
}

export function badRequest(message: string): APIGatewayProxyResult {
  return {
    statusCode: 400,
    headers: HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function unauthorized(message = 'Unauthorized'): APIGatewayProxyResult {
  return {
    statusCode: 401,
    headers: HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function forbidden(message = 'Forbidden'): APIGatewayProxyResult {
  return {
    statusCode: 403,
    headers: HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function notFound(message = 'Not found'): APIGatewayProxyResult {
  return {
    statusCode: 404,
    headers: HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function conflict(message: string): APIGatewayProxyResult {
  return {
    statusCode: 409,
    headers: HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function internalError(message = 'Internal server error'): APIGatewayProxyResult {
  return {
    statusCode: 500,
    headers: HEADERS,
    body: JSON.stringify({ error: message }),
  };
}
