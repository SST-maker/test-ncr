#!/bin/bash
cd "$(dirname "$0")" || exit 1
PORT=8787
URL="http://127.0.0.1:${PORT}/portfolio.html"
LOG="/tmp/ncr-portfolio-server.log"
SERVER_PID=""

echo ""
echo "N.C.R Solutions — Portfolio immersif 3D"
echo "Ouverture sur ${URL}"
echo ""

if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT" >"$LOG" 2>&1 &
  SERVER_PID=$!
elif command -v php >/dev/null 2>&1; then
  php -S "127.0.0.1:${PORT}" >"$LOG" 2>&1 &
  SERVER_PID=$!
elif command -v ruby >/dev/null 2>&1; then
  ruby -run -e httpd . -p "$PORT" >"$LOG" 2>&1 &
  SERVER_PID=$!
else
  echo "Aucun serveur local compatible n’a été trouvé."
  echo "Ouverture directe du fichier HTML avec le moteur WebGL natif."
  open "portfolio.html"
  exit 0
fi

sleep 1
open "$URL"
echo "Le portfolio reste disponible tant que cette fenêtre est ouverte."
echo "Pour arrêter le serveur : fermez cette fenêtre ou appuyez sur Ctrl+C."
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT INT TERM
wait "$SERVER_PID"
