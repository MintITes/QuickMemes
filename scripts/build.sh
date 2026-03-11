#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/../src/backend >/dev/null 2>&1 && pwd )"
BUILD_DIR="$DIR/build"
DEPS_DIR="$DIR/.deps"

# Handle optional clean flag
if [ "$1" == "--clean" ]; then
    echo "Cleaning build and deps directory..."
    rm -rf "$BUILD_DIR"
    rm -rf "$DEPS_DIR"
fi

if [ "$1" == "--test" ]; then
    echo "Cleaning..."
    rm -rf "$BUILD_DIR/tests" "$BUILD_DIR/Testing"
fi

echo "Building QuickMemes Backend (Incremental)..."
mkdir -p "$BUILD_DIR"
mkdir -p "$DEPS_DIR"

# Detect best available generator
GENERATOR_ARGS=""
if command -v ninja >/dev/null 2>&1; then
    echo "Ninja detected, using it for faster builds."
    GENERATOR_ARGS="-G Ninja"
else
    echo "Ninja not found, falling back to system default generator."
fi

# Generate build files
# Using -DFETCHCONTENT_BASE_DIR to keep dependency sources outside of the build folder
cd "$BUILD_DIR"
cmake $GENERATOR_ARGS \
      -DCMAKE_BUILD_TYPE=Debug \
      -DFETCHCONTENT_BASE_DIR="$DEPS_DIR" \
      ..

# Build
cmake --build . --parallel $(nproc)

echo "Build finished successfully."
