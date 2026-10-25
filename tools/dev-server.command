#!/bin/bash
# For developers: serve webapp/ on http://localhost:8420/ and open it in Chrome or Edge.
# End users do not need this: open https://topscoder.github.io/tc420-web/ once and
# the app keeps working offline (installable as an app).
# Offline caching only works in the built site: node scripts/build.mjs, then serve _site/.
cd "$(dirname "$0")/../webapp" || exit 1
PORT=8420
URL="http://localhost:$PORT/"

if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  sleep 1
else
  echo "Port $PORT is already in use; using the existing server."
fi

if open -Ra "Google Chrome" 2>/dev/null; then
  open -a "Google Chrome" "$URL"
elif open -Ra "Microsoft Edge" 2>/dev/null; then
  open -a "Microsoft Edge" "$URL"
else
  echo "Chrome or Edge not found. Open $URL in Chrome or Edge (Safari cannot connect to USB devices)."
fi

echo "TC420 Web is running at $URL. Close this window (or press Ctrl+C) to stop."
[ -n "$SERVER" ] && wait $SERVER
