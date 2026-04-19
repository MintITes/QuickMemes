#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/../src/frontend >/dev/null 2>&1 && pwd )"

echo "Installing frontend dependencies..."
cd "$DIR"
npm ci --no-audit --prefer-offline
echo "Dependencies installed."
