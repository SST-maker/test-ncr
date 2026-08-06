#!/bin/bash
cd "$(dirname "$0")" || exit 1
PORT=8787
URL="http://127.0.0.1:${PORT}/portfolio.html"

if command -v python3 >/dev/null 2>&1; then
  (sleep 1; open "$URL") &
  echo "N.C.R Solutions — Portfolio 3D"
  echo "Le portfolio va s'ouvrir à l'adresse : $URL"
  echo "Laisse cette fenêtre ouverte pendant le test."
  python3 -m http.server "$PORT"
elif command -v php >/dev/null 2>&1; then
  (sleep 1; open "$URL") &
  php -S "127.0.0.1:${PORT}"
else
  echo "Aucun serveur local n'a été trouvé."
  echo "Ouvre directement portfolio.html : la 3D est autonome et ne dépend d'aucun CDN."
  open "portfolio.html"
fi
