#!/bin/sh
# Builds dist/x-account-flags-<version>.zip for upload to addons.mozilla.org
# (self-distributed / unlisted signing) or for loading in Chromium browsers.
set -e
cd "$(dirname "$0")"
VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
mkdir -p dist
OUT="dist/x-account-flags-$VERSION.zip"
rm -f "$OUT"
zip -r -X "$OUT" manifest.json src >/dev/null
echo "built $OUT"
