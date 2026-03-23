import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { IFunction } from "aws-cdk-lib/aws-lambda";

export interface WebSocketApiStackProps extends cdk.StackProps {
  connectFn: IFunction;
  customActionFn: IFunction;
  disconnectFn: IFunction;
  defaultFn: IFunction;
  authorizerFn: IFunction;
  useCustomAuthorizer: "true" | "false";
}

export class WebSocketApiStack extends cdk.Stack {
  public readonly api: apigatewayv2.WebSocketApi;
  public readonly stage: apigatewayv2.WebSocketStage;
  public readonly apiId: string;
  public readonly stageName: string;

  constructor(scope: Construct, id: string, props: WebSocketApiStackProps) {
    super(scope, id, props);

    // Create WebSocket API
    this.api = new apigatewayv2.WebSocketApi(this, "MyWebSocketAPI", {
      routeSelectionExpression: "$request.body.action",
    });

    this.apiId = this.api.apiId;

    // Create Stage with auto-deployment
    this.stage = new apigatewayv2.WebSocketStage(this, "ProdStage", {
      webSocketApi: this.api,
      stageName: "prod",
      autoDeploy: true,
    });

    this.stageName = this.stage.stageName;

    // Create Lambda Integrations
    const connectIntegration = new integrations.WebSocketLambdaIntegration(
      "ConnectIntegration",
      props.connectFn,
    );

    const customActionIntegration = new integrations.WebSocketLambdaIntegration(
      "CustomActionIntegration",
      props.customActionFn,
    );

    const disconnectIntegration = new integrations.WebSocketLambdaIntegration(
      "DisconnectIntegration",
      props.disconnectFn,
    );

    const defaultIntegration = new integrations.WebSocketLambdaIntegration(
      "DefaultIntegration",
      props.defaultFn,
    );

    // Create WebSocket Authorizer using REQUEST type only when enabled.
    const webSocketAuthorizer =
      props.useCustomAuthorizer === "true"
        ? new authorizers.WebSocketLambdaAuthorizer(
            "WebSocketLambdaAuthorizer",
            props.authorizerFn,
            {
              identitySource: ["route.request.header.Host"],
            },
          )
        : undefined;

    // Create Routes
    // $connect route with conditional authorizer
    this.api.addRoute("$connect", {
      integration: connectIntegration,
      authorizer: webSocketAuthorizer,
    });

    const customActionRoute = this.api.addRoute("customAction", {
      integration: customActionIntegration,
    });

    this.api.addRoute("$disconnect", {
      integration: disconnectIntegration,
    });

    const defaultRoute = this.api.addRoute("$default", {
      integration: defaultIntegration,
    });

    // Route responses are required for two-way messages returned by Lambda.
    new apigatewayv2.CfnRouteResponse(this, "CustomActionRouteResponse", {
      apiId: this.api.apiId,
      routeId: customActionRoute.routeId,
      routeResponseKey: "$default",
    });

    new apigatewayv2.CfnRouteResponse(this, "DefaultRouteResponse", {
      apiId: this.api.apiId,
      routeId: defaultRoute.routeId,
      routeResponseKey: "$default",
    });

    // Outputs
    new cdk.CfnOutput(this, "WebSocketAPIEndpoint", {
      value: `wss://${this.api.apiId}.execute-api.${this.region}.amazonaws.com/${this.stage.stageName}`,
      description: "The API Gateway endpoint for the WebSocket API",
    });

    // new cdk.CfnOutput(this, "WebSocketAPIId", {
    //   value: this.api.apiId,
    //   description: "The WebSocket API ID",
    // });

    // new cdk.CfnOutput(this, "WebSocketStageName", {
    //   value: this.stage.stageName,
    //   description: "The WebSocket Stage Name",
    // });
  }
}
