#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/../src/backend >/dev/null 2>&1 && pwd )"
BUILD_DIR="$DIR/build"

echo "Running build.sh clean test..."
"./build.sh" --test

echo "Running tests..."
cd "$BUILD_DIR"
ctest --output-on-failure --parallel $(nproc) -V

echo "Tests passed successfully."
