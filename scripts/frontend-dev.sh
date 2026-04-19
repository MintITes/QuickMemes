#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/../src/frontend >/dev/null 2>&1 && pwd )"

cd "$DIR"

# Ensure dependencies are available (fast check)
if [ ! -d "node_modules" ]; then
    echo "Dependencies not found. Running npm install..."
    npm install
fi

echo "Starting Frontend Development Server..."
npm run dev
