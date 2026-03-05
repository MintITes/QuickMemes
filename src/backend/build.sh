#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
BUILD_DIR="$DIR/build"

echo "Building QuickMemes Backend..."
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Generate build files
cmake -DCMAKE_BUILD_TYPE=Debug ..

# Build
cmake --build . --parallel $(nproc)

echo "Build finished successfully."
