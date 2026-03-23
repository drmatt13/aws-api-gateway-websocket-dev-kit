import { APIGatewayProxyResultV2 } from "aws-lambda";
import { WebSocket } from "ws";

interface LocalLambdaInvocation {
  statusCode: number;
  body?: string | undefined;
}

export default async function invokeLambdaFunction(
  ws: WebSocket,
  callback: (
    ...args: any[]
  ) => Promise<APIGatewayProxyResultV2 | LocalLambdaInvocation>, // Fix the callback type to accept any number of arguments
  ...args: any[] // Spread the arguments properly
): Promise<void> {
  const response = await callback(...args);
  if ((response as LocalLambdaInvocation).body) {
    ws.send((response as LocalLambdaInvocation).body as string);
  }
  return;
}
