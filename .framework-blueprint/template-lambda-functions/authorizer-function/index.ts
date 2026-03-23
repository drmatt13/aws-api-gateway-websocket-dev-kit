import { APIGatewayAuthorizerResult } from "aws-lambda";

interface WebSocketAuthorizerEvent {
  type: string;
  methodArn: string;
  requestContext: {
    connectionId: string;
    apiId: string;
    stage: string;
  };
  queryStringParameters?: Record<string, string> | null;
  headers?: Record<string, string> | null;
}

export const lambdaHandler = async (
  event: WebSocketAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  // Extract idToken from query parameters, you can optionally use any other parameter for authorization logic
  const idToken = event.queryStringParameters?.idToken ?? null;

  if (idToken) {
    console.log("idToken obtained from query parameters:", idToken);
  } else {
    console.log("No idToken found in query parameters - denying connection");
  }

  return {
    principalId: "user",
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: idToken ? "Allow" : "Deny", // Will prevent $connect from succeeding
          Resource: event.methodArn,
        },
      ],
    },
  };
};
