#!/usr/bin/env bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
DIR="$( cd "$SCRIPT_DIR"/../src/backend >/dev/null 2>&1 && pwd )"
BUILD_DIR="$DIR/build"

echo "Running build.sh clean test..."
"$SCRIPT_DIR/build.sh" --test

echo "Running tests..."
cd "$BUILD_DIR"
ctest --output-on-failure --parallel $(nproc) -V

echo "Tests passed successfully."
