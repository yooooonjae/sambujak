#!/usr/bin/env bash
# og.html → og.png (1200×630) 헤드리스 캡처.
# CHROME 자동탐색: 환경변수 CHROME 우선, 없으면 흔한 명령/경로를 순회.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$DIR/og.html"
OUT="$DIR/og.png"

CHROME="${CHROME:-}"
if [ -z "$CHROME" ]; then
  for c in \
    "$(command -v google-chrome 2>/dev/null || true)" \
    "$(command -v google-chrome-stable 2>/dev/null || true)" \
    "$(command -v chromium 2>/dev/null || true)" \
    "$(command -v chromium-browser 2>/dev/null || true)" \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"; do
    if [ -n "$c" ] && [ -x "$c" ]; then CHROME="$c"; break; fi
  done
fi

if [ -z "$CHROME" ]; then
  echo "ERROR: Chrome/Chromium을 찾을 수 없습니다. CHROME=/path/to/chrome 로 지정하세요." >&2
  exit 1
fi
echo "CHROME = $CHROME"

"$CHROME" --headless --disable-gpu --hide-scrollbars --no-sandbox \
  --force-device-scale-factor=1 --window-size=1200,630 \
  --virtual-time-budget=2000 \
  --screenshot="$OUT" "file://$SRC"

mkdir -p "$DIR/web"
cp "$OUT" "$DIR/web/og.png"
echo "wrote: $OUT"
echo "wrote: $DIR/web/og.png"
