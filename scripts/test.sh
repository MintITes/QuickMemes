#!/usr/bin/env bash
set -e

DIR="../src/backend"
BUILD_DIR="$DIR/build"

echo "Running build.sh clean test..."
"./build.sh" --test

echo "Running tests..."
cd "$BUILD_DIR"
ctest --output-on-failure --parallel $(nproc) -V

echo "Tests passed successfully."
