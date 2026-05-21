#!/usr/bin/env bash
# Regenerate the PNG icon files from icons/icon.svg.
# Run after meaningful changes to icon.svg. Requires librsvg
# (`brew install librsvg`).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/icons"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "Error: rsvg-convert not found. Install with: brew install librsvg" >&2
  exit 1
fi

for size in 16 32 48 128; do
  rsvg-convert -w "$size" -h "$size" icon.svg -o "icon${size}.png"
  echo "  Wrote icon${size}.png"
done
