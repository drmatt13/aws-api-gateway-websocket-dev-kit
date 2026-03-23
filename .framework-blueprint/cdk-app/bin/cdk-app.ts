#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { WebSocketHandlersStack } from "../lib/websocket-handlers-stack";
import { WebSocketApiStack } from "../lib/websocket-api-stack";

const app = new cdk.App();

// Read context values for stage and authorizer usage
const stage = app.node.tryGetContext("stage") ?? "dev"; // "prod" or "dev" (default to "dev" if not set)
const useCustomAuthorizer = app.node.tryGetContext("useCustomAuthorizer") // "true" or "false" (default to "false" if not set)
  ? "true"
  : "false";

// const cognitoStack = new CognitoStack(app, "CdkCognitoStack", {});

// Create handlers stack first (without API details)
const handlersStack = new WebSocketHandlersStack(
  app,
  "WebSocketHandlersStack",
  {},
);

// Create API stack with the handler functions
const apiStack = new WebSocketApiStack(app, "WebSocketApiStack", {
  connectFn: handlersStack.connectFn,
  customActionFn: handlersStack.customActionFn,
  disconnectFn: handlersStack.disconnectFn,
  defaultFn: handlersStack.defaultFn,
  authorizerFn: handlersStack.authorizerFn,
  useCustomAuthorizer,
});
