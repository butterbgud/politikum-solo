# Politikum Solo

Static, local single-player Politikum for desktop and mobile browsers.

## Deploy

This is a standard Vite project: import this directory into Vercel, leave the build command as `npm run build`, and publish `dist`. It makes no WebSocket, database, admin, tournament, or authentication requests.

### Bug reports to Telegram

The in-game **Report bug** button sends an optional player note plus the last 30 Chronicle entries to a private Telegram chat. Set these Vercel environment variables before deploying:

```text
TELEGRAM_BOT_TOKEN=<bot token>
TELEGRAM_BUG_CHAT_ID=<channel or chat id>
```

They are used only by `api/bugreport.js` on Vercel; neither value is exposed to the browser or committed to Git. Without them, the report button safely shows a delivery error.

## Local development

```sh
npm install
npm run dev
```

The game state is local to the open browser tab. Refreshing starts a fresh local match.
