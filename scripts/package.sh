#!/usr/bin/env bash
# Package the extension into a zip suitable for upload to the
# Chrome Web Store Developer Dashboard. Includes only the files
# Chrome actually loads at runtime — README, CLAUDE.md, .git, the
# packaging scripts themselves, etc. are deliberately excluded.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION=$(jq -r '.version' manifest.json)
if [[ -z "$VERSION" || "$VERSION" == "null" ]]; then
  echo "Error: could not read version from manifest.json" >&2
  exit 1
fi

OUT_DIR="dist"
OUT_FILE="$OUT_DIR/element-identifier-v$VERSION.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

# Explicit allowlist of runtime assets. If you add a new file the
# extension loads at runtime (a new content script, a new icon size,
# a new HTML page for an options surface, etc.), add it here too.
zip -r "$OUT_FILE" \
  manifest.json \
  background.js \
  content.js \
  icons/icon.svg \
  icons/icon16.png \
  icons/icon32.png \
  icons/icon48.png \
  icons/icon128.png \
  > /dev/null

echo
echo "  Packaged $OUT_FILE"
printf "  Size:    "; du -h "$OUT_FILE" | cut -f1
echo
echo "  Contents:"
unzip -Z1 "$OUT_FILE" | sed 's/^/    /'
echo
echo "  Smoke-test before upload:"
echo "    unzip -d /tmp/ei-verify $OUT_FILE"
echo "    chrome://extensions → Load unpacked → /tmp/ei-verify"
