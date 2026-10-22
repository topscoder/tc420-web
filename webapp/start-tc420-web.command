#!/bin/bash
# Start de TC420 Web offline: lokale webserver + Chrome (of Edge).
# Dubbelklik in Finder; sluit dit Terminal-venster om de server te stoppen.
cd "$(dirname "$0")" || exit 1
PORT=8420
URL="http://localhost:$PORT/"

if ! lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  sleep 1
else
  echo "Poort $PORT is al in gebruik; ik gebruik de bestaande server."
  URL="http://localhost:$PORT/webapp/"
  curl -s -o /dev/null -w '%{http_code}' "$URL" | grep -q 200 || URL="http://localhost:$PORT/"
fi

if open -Ra "Google Chrome" 2>/dev/null; then
  open -a "Google Chrome" "$URL"
elif open -Ra "Microsoft Edge" 2>/dev/null; then
  open -a "Microsoft Edge" "$URL"
else
  echo "Chrome of Edge niet gevonden. Open $URL in Chrome of Edge (Safari werkt niet)."
fi

echo "TC420 Web draait op $URL"
echo "Sluit dit venster (of druk Ctrl+C) om te stoppen."
[ -n "$SERVER" ] && wait $SERVER
