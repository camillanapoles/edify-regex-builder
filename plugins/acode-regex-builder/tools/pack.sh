#!/data/data/com.termux/files/usr/bin/sh
# Build + package the Acode plugin zip. Run: sh tools/pack.sh
set -eu
cd "$(dirname "$0")/.."

bun build src/main.ts --target browser --format=iife --minify --outfile dist/main.js

rm -f dist.zip
rm -rf .stage
mkdir .stage
cp plugin.json readme.md changelogs.md icon.png .stage/
cp dist/main.js .stage/main.js
(cd .stage && zip -q -X ../dist.zip plugin.json main.js readme.md changelogs.md icon.png)
rm -rf .stage
echo "packed dist.zip"
