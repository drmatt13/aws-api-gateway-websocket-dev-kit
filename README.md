# aws-api-gateway-websocket-dev-kit

aws-api-gateway-websocket-dev-kit is a framework-agnostic monorepo for building and testing AWS API Gateway WebSocket Lambda integrations with fast local iteration.

## Architecture

![Architecture diagram](./sam-websocket-dev-kit.drawio.svg)

## Components

- `sam-app` or `cdk-app`: infrastructure app and Lambda route handlers (selected during bootstrap)
- `local-ws-dev-server`: local server that emulates API Gateway WebSocket integrations, including custom authorizers
- `frontend-ws-connection-and-payload-tester`: frontend tool to test local and deployed sockets side by side

## What this project does

- Uses `bootstrap_app.py` at the repo root to scaffold the project for AWS SAM or AWS CDK and install Node packages across the monorepo
- Emulates API Gateway WebSocket behavior locally so payload handling matches deployed behavior
- Emulates custom authorizer behavior for local route authorization testing
- Lets you add new routes in `local-ws-dev-server` and create matching Lambda functions in your selected app (`sam-app/src` or `cdk-app/lambda_functions`)
- Lets the frontend connect to both local and deployed AWS WebSocket endpoints at the same time
- Supports rapid development with either framework:
	- AWS SAM: use `sam sync`
	- AWS CDK: use `cdk deploy`

## Quick start

1. Bootstrap the project from the repo root and choose a framework (`aws-sam` or `aws-cdk`) when prompted:

```bash
python bootstrap_app.py
```

2. Deploy your selected framework app.

AWS SAM path:

```bash
cd sam-app
sam build
sam deploy --guided
```

AWS CDK path:

```bash
cd cdk-app
npm run build
npx cdk deploy
```

3. Start the local WebSocket emulator:

```bash
cd ../local-ws-dev-server
npm run dev
```

4. Start the frontend tester:

```bash
cd ../frontend-ws-connection-and-payload-tester
npm run dev
```

## Workflow

1. Edit Lambda handlers in your selected framework app:
	- AWS SAM: `sam-app/src`
	- AWS CDK: `cdk-app/lambda_functions`
2. Send payloads from the frontend to local and deployed endpoints in parallel
3. Verify local responses match deployed behavior
4. Deploy updates quickly:
	- AWS SAM: `sam sync`
	- AWS CDK: `cdk deploy`

## Extending routes

1. Add a new route and Lambda in your selected app (`sam-app` or `cdk-app`)
2. Add matching route handling in `local-ws-dev-server`
3. Test both environments from the frontend
