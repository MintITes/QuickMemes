#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
BUILD_DIR="$DIR/build"

if [ ! -d "$BUILD_DIR" ]; then
    echo "Build directory not found. Running build.sh first..."
    "$DIR/build.sh"
fi

echo "Running tests..."
cd "$BUILD_DIR"
ctest --output-on-failure -V

echo "Tests passed successfully."
