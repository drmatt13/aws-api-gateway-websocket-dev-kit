import { APIGatewayProxyResultV2 } from "aws-lambda";

export const lambdaHandler = async (
  event: WebSocketEvent,
): Promise<APIGatewayProxyResultV2> => {
  // Parse the incoming event to extract relevant information
  const parsedEvent = {
    routeKey: event.requestContext.routeKey,
    ...(event.body && {
      body: JSON.parse(event.body) as { message: string },
    }),
    connectionId: event.requestContext.connectionId,
  };

  // create a custom response
  const Data = JSON.stringify({
    route: "customAction",
    recievedMessage: parsedEvent.body?.message || "No message received",
    connectionId: parsedEvent.connectionId,
  });

  return {
    statusCode: 200,
    body: Data, // This will be sent back to the client as the response to the WebSocket message
  };
};
