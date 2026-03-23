/**
 * ConnectionPoster
 * -----------------------------------------------------------------------------
 * Sends messages to WebSocket connections in both local and AWS environments.
 *
 * - UUID connectionIds → routed to local WS ingest server (HTTP POST)
 * - Non-UUID connectionIds → sent via API Gateway (PostToConnection)
 *
 * Provides a single interface for posting messages without needing to know
 * the underlying environment.
 *
 *  * Example:
 *   await connectionPoster.postToConnection(connectionId, JSON.stringify(payload));
 *
 */

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

export interface ConnectionPosterConfig {
  region: string;
  apiGatewayEndpoint: string;
  localWsServerEndpoint: string;
}

export class ConnectionPoster {
  private readonly client: ApiGatewayManagementApiClient;

  constructor(private readonly config: ConnectionPosterConfig) {
    this.client = new ApiGatewayManagementApiClient({
      region: this.config.region,
      endpoint: this.config.apiGatewayEndpoint,
    });
  }

  private isUuidConnectionId(connectionId: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      connectionId,
    );
  }

  private parseOutboundData(data: string): unknown {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  private async postToLocalIngest(connectionId: string, data: string) {
    const response = await fetch(this.config.localWsServerEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        connectionId,
        payload: this.parseOutboundData(data),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Local ingest failed (${response.status}): ${errorBody || response.statusText}`,
      );
    }

    console.log(`Message sent to local connection ${connectionId}: ${data}`);
  }

  private async postToApiGateway(connectionId: string, data: string) {
    const command = new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: data,
    });

    await this.client.send(command);
    console.log(
      `Message sent to API Gateway connection ${connectionId}: ${data}`,
    );
  }

  async postToConnection(connectionId: string, data: string): Promise<void> {
    try {
      if (this.isUuidConnectionId(connectionId)) {
        await this.postToLocalIngest(connectionId, data);
        return;
      }

      await this.postToApiGateway(connectionId, data);
    } catch (error) {
      console.error(
        `Failed to send message to connection ${connectionId}:`,
        error,
      );
    }
  }
}

export default ConnectionPoster;
