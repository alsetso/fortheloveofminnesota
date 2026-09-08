#!/usr/bin/env bash
# Launch web v2 (Next.js) on port 3001 and open it in the browser.
# Usage: ./scripts/dev-web-v2.sh
# Stop: Ctrl+C

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$ROOT/apps/web_v2"
PORT=3001
URL="http://localhost:${PORT}"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. Install: npm i -g pnpm"
  exit 1
fi

if [[ ! -d "$WEB_DIR" ]]; then
  echo "Web v2 not found at $WEB_DIR"
  exit 1
fi

if [[ ! -f "$WEB_DIR/.env.local" ]]; then
  echo "No apps/web_v2/.env.local yet — continuing without it."
  echo "When you wire Supabase, copy env.example (same keys as v1, port 3001)."
fi

open_when_ready() {
  local attempts=0
  while (( attempts < 80 )); do
    if curl -sf -o /dev/null --max-time 1 "$URL" >/dev/null 2>&1; then
      open "$URL"
      return
    fi
    sleep 0.25
    attempts=$((attempts + 1))
  done
}

echo "Starting web v2 → $URL"
open_when_ready &
cd "$WEB_DIR"
exec pnpm dev
