# Politikum Solo

Static, local single-player Politikum for desktop and mobile browsers.

## Deploy

This is a standard Vite static project: import this directory into Vercel, leave the build command as `npm run build`, and publish `dist`. It makes no API, WebSocket, database, admin, tournament, or authentication requests.

## Local development

```sh
npm install
npm run dev
```

The game state is local to the open browser tab. Refreshing starts a fresh local match.
