import { APIGatewayProxyResultV2 } from "aws-lambda";

export const lambdaHandler = async (
  event: WebSocketEvent,
): Promise<APIGatewayProxyResultV2> => {
  const parsedEvent = {
    routeKey: event.requestContext.routeKey,
    connectionId: event.requestContext.connectionId,
  };

  // Here you can handle the disconnection logic if needed
  console.log("Disconnected:", parsedEvent.connectionId);

  return {
    statusCode: 200,
  };
};
