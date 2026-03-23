import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";

export interface WebSocketHandlersStackProps extends cdk.StackProps {
  apiId?: string;
  stageName?: string;
}

export class WebSocketHandlersStack extends cdk.Stack {
  public readonly connectFn: nodejs.NodejsFunction;
  public readonly customActionFn: nodejs.NodejsFunction;
  public readonly disconnectFn: nodejs.NodejsFunction;
  public readonly defaultFn: nodejs.NodejsFunction;
  public readonly authorizerFn: nodejs.NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    props: WebSocketHandlersStackProps,
  ) {
    super(scope, id, props);

    // Connect Route Handler
    this.connectFn = new nodejs.NodejsFunction(this, "ConnectRouteFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(
        __dirname,
        "..",
        "lambda_functions",
        "connect-route-function",
        "index.ts",
      ),
      handler: "lambdaHandler",
      bundling: {
        minify: true,
        target: "es2020",
        sourceMap: true,
      },
      timeout: cdk.Duration.seconds(3),
      memorySize: 128,
      environment: {
        PRODUCTION: "true",
      },
    });

    // Custom Action Route Handler (needs API management permissions)
    this.customActionFn = new nodejs.NodejsFunction(
      this,
      "CustomActionRouteFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          "..",
          "lambda_functions",
          "customAction-route-function",
          "index.ts",
        ),
        handler: "lambdaHandler",
        bundling: {
          minify: true,
          target: "es2020",
          sourceMap: true,
        },
        timeout: cdk.Duration.seconds(3),
        memorySize: 128,
        environment: {
          PRODUCTION: "true",
          ...(props.apiId && { API_ID: props.apiId }),
          ...(props.stageName && { STAGE: props.stageName }),
        },
      },
    );

    // Grant permission to manage connections
    if (props.apiId && props.stageName) {
      this.customActionFn.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["execute-api:ManageConnections"],
          resources: [
            `arn:aws:execute-api:${this.region}:${this.account}:${props.apiId}/${props.stageName}/*`,
          ],
        }),
      );
    }

    // Disconnect Route Handler
    this.disconnectFn = new nodejs.NodejsFunction(
      this,
      "DisconnectRouteFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          "..",
          "lambda_functions",
          "disconnect-route-function",
          "index.ts",
        ),
        handler: "lambdaHandler",
        bundling: {
          minify: true,
          target: "es2020",
          sourceMap: true,
        },
        timeout: cdk.Duration.seconds(3),
        memorySize: 128,
        environment: {
          PRODUCTION: "true",
        },
      },
    );

    // Default Route Handler (needs API management permissions)
    this.defaultFn = new nodejs.NodejsFunction(this, "DefaultRouteFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(
        __dirname,
        "..",
        "lambda_functions",
        "default-route-function",
        "index.ts",
      ),
      handler: "lambdaHandler",
      bundling: {
        minify: true,
        target: "es2020",
        sourceMap: true,
      },
      timeout: cdk.Duration.seconds(3),
      memorySize: 128,
      environment: {
        PRODUCTION: "true",
        ...(props.apiId && { API_ID: props.apiId }),
        ...(props.stageName && { STAGE: props.stageName }),
      },
    });

    // Grant permission to manage connections
    if (props.apiId && props.stageName) {
      this.defaultFn.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["execute-api:ManageConnections"],
          resources: [
            `arn:aws:execute-api:${this.region}:${this.account}:${props.apiId}/${props.stageName}/*`,
          ],
        }),
      );
    }

    // Authorizer Function
    this.authorizerFn = new nodejs.NodejsFunction(this, "AuthorizerFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(
        __dirname,
        "..",
        "lambda_functions",
        "authorizer-function",
        "index.ts",
      ),
      handler: "lambdaHandler",
      bundling: {
        minify: true,
        target: "es2020",
        sourceMap: true,
      },
      timeout: cdk.Duration.seconds(3),
      memorySize: 128,
      environment: {
        PRODUCTION: "true",
      },
    });

    // Outputs
    // new cdk.CfnOutput(this, "ConnectRouteFunctionName", {
    //   value: this.connectFn.functionName,
    //   description: "Name of the Connect Route Handler",
    // });

    // new cdk.CfnOutput(this, "CustomActionRouteFunctionName", {
    //   value: this.customActionFn.functionName,
    //   description: "Name of the Custom Action Route Handler",
    // });

    // new cdk.CfnOutput(this, "DisconnectRouteFunctionName", {
    //   value: this.disconnectFn.functionName,
    //   description: "Name of the Disconnect Route Handler",
    // });

    // new cdk.CfnOutput(this, "DefaultRouteFunctionName", {
    //   value: this.defaultFn.functionName,
    //   description: "Name of the Default Route Handler",
    // });

    // new cdk.CfnOutput(this, "AuthorizerFunctionName", {
    //   value: this.authorizerFn.functionName,
    //   description: "Name of the Lambda Authorizer",
    // });
  }
}
