#!/bin/sh
# Local dev server with live reload: http://localhost:5500
cd "$(dirname "$0")" && npx --yes live-server --port=5500 --no-browser --quiet
