#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/../src/frontend >/dev/null 2>&1 && pwd )"

cd "$DIR"

if [ ! -d "node_modules" ]; then
    echo "Dependencies not found. Running npm ci..."
    npm ci --no-audit --prefer-offline
fi

echo "Running Frontend Vitest Suite..."
if [ "${GITHUB_ACTIONS:-}" = "true" ] || [ "${CI:-}" = "true" ]; then
    REPORT_DIR="$DIR/test-results"
    mkdir -p "$REPORT_DIR"
    npm run test:run -- --reporter=default --reporter=json --outputFile="$REPORT_DIR/vitest-report.json"
else
    npm run test:run
fi

echo "Tests Passed."
