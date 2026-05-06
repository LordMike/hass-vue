#!/usr/bin/with-contenv bashio
set -euo pipefail

cd /app
exec node src/main.mjs
