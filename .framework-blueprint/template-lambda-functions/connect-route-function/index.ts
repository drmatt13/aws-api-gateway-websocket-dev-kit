import { APIGatewayProxyResultV2 } from "aws-lambda";

export const lambdaHandler = async (
  event: WebSocketEvent,
): Promise<APIGatewayProxyResultV2> => {
  const parsedEvent = {
    routeKey: event.requestContext.routeKey,
    connectionId: event.requestContext.connectionId,
    domainName: event.requestContext.domainName,
    queryParams: event.queryStringParameters,
  };

  console.log(
    "User:",
    parsedEvent?.queryParams?.idToken,
    "Connected via:",
    parsedEvent.connectionId,
  );

  // Return a response to indicate that the connection was accepted
  // You cannot send a message back to the client from the connect route
  return {
    statusCode: 200,
  };
};
