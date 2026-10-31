#!/bin/sh
# Builds dist/x-account-flags-<version>.zip for upload to addons.mozilla.org
# (self-distributed / unlisted signing) or for loading in Chromium browsers.
set -e
cd "$(dirname "$0")"
VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json | head -1)
mkdir -p dist
OUT="dist/x-account-flags-$VERSION.zip"
rm -f "$OUT"
zip -r -X "$OUT" manifest.json src >/dev/null
echo "built $OUT"
