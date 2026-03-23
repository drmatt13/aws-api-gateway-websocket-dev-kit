# sam-websocket-dev-kit

sam-websocket-dev-kit is a monorepo for building and testing AWS API Gateway WebSocket Lambda integrations with fast local iteration.

## Architecture

![Architecture diagram](./sam-websocket-dev-kit.drawio.svg)

## Components

- `sam-app`: AWS SAM template and Lambda route handlers
- `local-ws-server`: local server that emulates API Gateway WebSocket integrations, including custom authorizers
- `frontend-ws-connection-and-payload-tester`: frontend tool to test local and deployed sockets side by side

## What this project does

- Uses `bootstrap_node_packages.py` at the repo root to install Node packages across the monorepo
- Emulates API Gateway WebSocket behavior locally so payload handling matches deployed behavior
- Emulates custom authorizer behavior for local route authorization testing
- Lets you add new routes in `local-ws-server` and create matching Lambda functions in `sam-app`
- Lets the frontend connect to both local and deployed AWS WebSocket endpoints at the same time
- Supports rapid development: edit Lambda code, test immediately via local socket connection, then run `sam sync` to push updates to AWS

## Quick start

1. Install monorepo dependencies from the repo root:

```bash
python bootstrap_node_packages.py
```

2. Build and deploy the SAM app:

```bash
cd sam-app
sam build
sam deploy --guided
```

3. Start the local WebSocket emulator:

```bash
cd ../local-ws-server
npm run dev
```

4. Start the frontend tester:

```bash
cd ../frontend-ws-connection-and-payload-tester
npm run dev
```

## Workflow

1. Edit Lambda handlers in `sam-app/src`
2. Send payloads from the frontend to local and deployed endpoints in parallel
3. Verify local responses match deployed behavior
4. Run `sam sync` to deploy updates quickly

## Extending routes

1. Add a new route and Lambda in `sam-app`
2. Add matching route handling in `local-ws-server`
3. Test both environments from the frontend
