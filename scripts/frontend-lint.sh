#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/../src/frontend >/dev/null 2>&1 && pwd )"

cd "$DIR"

if [ ! -d "node_modules" ]; then
    echo "Dependencies not found. Running npm ci..."
    npm ci --no-audit --prefer-offline
fi

echo "Running Frontend Linter (ESLint)..."
npm run lint

echo "Linter Check Passed."
