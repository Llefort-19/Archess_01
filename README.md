# Archess

A modern browser-based game inspired by the classic "Archon".

## Packages

- `packages/client`: Frontend React application (Vite)
- `packages/server`: Backend Node.js server (Express, Socket.IO)
- `packages/shared`: Shared types and configurations

## Development

To start both client and server in development mode:

```bash
yarn install
yarn dev
```

## Building

To build the server for production:

```bash
yarn build:server
```

## Running Production Server

```bash
yarn start:server
```

## Linting & Formatting

```bash
yarn lint
yarn format
yarn check-types
```
