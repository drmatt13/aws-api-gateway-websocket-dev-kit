// =======================================
//  ⬆️ Append more Lambda functions here as needed
//  Define new WebSocket route handlers following this structure
// =======================================

import { createServer } from "http";
import { randomUUID } from "crypto";
import { WebSocket, WebSocketServer } from "ws";
import env from "dotenv";

import invokeLambdaFunction from "../lib/invokeLambdaFunction";

import {
  connectEvent,
  defaultEvent,
  disconnectEvent,
} from "../events/websocketEvents";

env.config({
  path: "./.env.development",
});

const PORT = Number(process.env.PORT) || 8080;
const server = createServer(); // Create an HTTP server for handling WebSocket upgrades
const connectionRegistry = new Map<WebSocket, string>();
const connectionIdRegistry = new Map<string, WebSocket>();

function removeConnection(ws: WebSocket): void {
  const connectionId = connectionRegistry.get(ws);
  if (!connectionId) {
    return;
  }

  connectionRegistry.delete(ws);
  connectionIdRegistry.delete(connectionId);
}

// =======================================
//  📥 Local Ingestion Route
//  POST /ingest with JSON: { connectionId, message }
// =======================================
server.on("request", (req, res) => {
  if (req.method !== "POST" || req.url !== "/ingest") {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Not Found" }));
    return;
  }

  let rawBody = "";

  req.on("data", (chunk) => {
    rawBody += chunk.toString();
  });

  req.on("end", () => {
    try {
      const payload = JSON.parse(rawBody) as {
        connectionId?: unknown;
        payload?: unknown;
        data?: unknown;
        message?: unknown;
      };

      if (
        !payload.connectionId ||
        typeof payload.connectionId !== "string" ||
        payload.connectionId.trim() === ""
      ) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "connectionId is required" }));
        return;
      }

      const outboundPayload =
        payload.payload ?? payload.data ?? payload.message ?? undefined;

      if (outboundPayload === undefined) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: "Provide one of: payload, data, or message",
          }),
        );
        return;
      }

      const targetWs = connectionIdRegistry.get(payload.connectionId);
      if (!targetWs || targetWs.readyState !== WebSocket.OPEN) {
        if (targetWs && targetWs.readyState !== WebSocket.OPEN) {
          removeConnection(targetWs);
        }

        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: "No active connection for this connectionId",
            connectionId: payload.connectionId,
          }),
        );
        return;
      }

      targetWs.send(JSON.stringify(outboundPayload));

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          status: "sent",
          connectionId: payload.connectionId,
          deliveredType: Array.isArray(outboundPayload)
            ? "array"
            : typeof outboundPayload,
        }),
      );
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid JSON" }));
    }
  });
});

// =======================================
//  🔄 WebSocket Server in "noServer" Mode
//  This prevents unauthorized connections before they are fully established
// =======================================
const wss = new WebSocketServer({ noServer: true });

// =======================================
//  🛑 WebSocket Upgrade Interception
//  Handles incoming WebSocket upgrade requests BEFORE connection establishment
// =======================================
server.on("upgrade", async (request, socket, head) => {
  try {
    const connectionId = randomUUID();

    // =======================================
    //  🔗 WebSocket Route: "$connect"
    //  Invoked before allowing the connection
    // =======================================
    const host = request.headers.host || "localhost";
    const requestUrl = new URL(request.url || "/", `http://${host}`);

    const singleValueQueryParams: Record<string, string> = {};
    const multiValueQueryParams: Record<string, string[]> = {};

    for (const [key, value] of requestUrl.searchParams.entries()) {
      if (!(key in singleValueQueryParams)) {
        singleValueQueryParams[key] = value;
      }

      if (!(key in multiValueQueryParams)) {
        multiValueQueryParams[key] = [];
      }

      multiValueQueryParams[key].push(value);
    }

    const currentConnectEvent: WebSocketEvent = {
      ...connectEvent,
      headers: {
        ...connectEvent.headers,
        Origin: request.headers.origin,
      },
      requestContext: {
        ...connectEvent.requestContext,
        domainName: request.headers.host,
        connectionId,
      },
      queryStringParameters: {
        ...connectEvent.queryStringParameters,
        ...singleValueQueryParams,
      },
      multiValueQueryStringParameters: {
        ...connectEvent.multiValueQueryStringParameters,
        ...multiValueQueryParams,
      },
    };

    // Optional custom authorizer check before accepting WebSocket connection
    if (process.env.ENABLE_CUSTOM_Authorizer === "true") {
      const authorizerEvent = {
        type: "REQUEST",
        methodArn: "arn:aws:execute-api:local:local:local/prod/$connect",
        requestContext: {
          connectionId,
          apiId: "local",
          stage: "prod",
        },
        queryStringParameters: singleValueQueryParams,
        headers: request.headers as Record<string, string>,
      };

      const authorizerResponse = await customAuthorizerLambdaHandler(
        authorizerEvent as any,
      );

      const hasDeny = (authorizerResponse.policyDocument?.Statement || []).some(
        (statement: any) => statement.Effect === "Deny",
      );

      if (hasDeny) {
        console.log("❌ Connection rejected by custom authorizer.");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    // =======================================
    //  🔗 WebSocket Route: "$connect"
    //  Triggered when a client connects
    // =======================================
    const connectResponse =
      await $connectRouteKeyLambdaHandler(currentConnectEvent);

    // =======================================
    //  🛑 Deny Connection if Unauthorized
    // =======================================
    if (
      (connectResponse as any).statusCode &&
      [403, 401, 500, 502, 503, 504].includes(
        (connectResponse as any).statusCode,
      )
    ) {
      console.log("❌ Connection rejected by $connect Lambda.");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); // Send 401 response
      socket.destroy();
      return;
    }

    // =======================================
    //  🔄 Upgrade WebSocket Connection
    //  Only proceed if Lambda allows the connection
    // =======================================
    wss.handleUpgrade(request, socket, head, (ws) => {
      connectionRegistry.set(ws, connectionId);
      connectionIdRegistry.set(connectionId, ws);
      wss.emit("connection", ws, request);
    });
  } catch (error) {
    console.error("🚨 Error during $connect Lambda execution:", error);
    socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
    socket.destroy();
  }
});

// =======================================
//  🎯 WebSocket Connection Event
//  This executes only for authorized connections
// =======================================
wss.on("connection", async (ws) => {
  const connectionId = connectionRegistry.get(ws);

  if (!connectionId) {
    ws.close(1011, "Missing connection id");
    return;
  }

  // =======================================

  ws.on("message", async (message) => {
    const body = JSON.parse(message.toString());
    const messageEvent: WebSocketEvent = {
      ...defaultEvent,
      body: JSON.stringify({ ...body, action: undefined }),
      requestContext: {
        ...defaultEvent.requestContext,
        routeKey: body.action,
        connectionId,
      },
    };

    // =======================================
    //  🔄 Dynamic WebSocket Route Handling
    //  Routes messages based on body.action
    // =======================================
    switch (body.action) {
      // =======================================
      //  🎯 WebSocket Route: "customAction"
      // =======================================
      case "customAction":
        await invokeLambdaFunction(
          ws,
          customActionRouteKeyLambdaHandler,
          messageEvent,
        );
        break;

      // =======================================
      //  🔧 WebSocket Route: "customAction2" (Placeholder)
      //  Uncomment and modify to add new routes
      // =======================================
      // case "customAction2":
      //   await invokeLambdaFunction(
      //     ws,
      //     customAction2RouteKeyLambdaHandler,
      //     messageEvent
      //   );
      //   break;

      // =======================================
      //  🌎 WebSocket Route: "$default"
      //  Handles unmatched routes
      // =======================================
      default:
        await invokeLambdaFunction(
          ws,
          $defaultRouteKeyLambdaHandler,
          messageEvent,
        );
    }
  });

  // =======================================
  //  ❌ WebSocket Route: "$disconnect"
  //  Triggered when a client disconnects
  // =======================================
  ws.on("close", async () => {
    const currentDisconnectEvent: WebSocketEvent = {
      ...disconnectEvent,
      requestContext: {
        ...disconnectEvent.requestContext,
        connectionId,
      },
    };

    await $disconnectRouteKeyLambdaHandler(currentDisconnectEvent);
    removeConnection(ws);
  });

  ws.on("error", () => {
    removeConnection(ws);
  });
});

// =======================================
//  🚀 Start WebSocket Server
// =======================================
server.listen(PORT, () => {
  console.log(`WebSocket server listening on ws://localhost:${PORT}`);
  if (process.env.ENABLE_CUSTOM_Authorizer === "true") {
    console.log("✅ Custom Authorizer is ENABLED");
  } else {
    console.log("❌ Custom Authorizer is DISABLED");
  }
});
