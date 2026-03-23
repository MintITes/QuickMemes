#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/../src/backend >/dev/null 2>&1 && pwd )"
BUILD_DIR="$DIR/build-release"
DEPS_DIR="$DIR/.deps-release"

if [ "$1" == "--clean" ]; then
    echo "Cleaning release build and deps directory..."
    rm -rf "$BUILD_DIR"
    rm -rf "$DEPS_DIR"
fi

if [ "$1" == "--test" ]; then
    echo "Cleaning release test artifacts..."
    rm -rf "$BUILD_DIR/tests" "$BUILD_DIR/Testing"
fi

echo "Building QuickMemes Backend (Release)..."
mkdir -p "$BUILD_DIR"
mkdir -p "$DEPS_DIR"

GENERATOR_ARGS=""
if command -v ninja >/dev/null 2>&1; then
    echo "Ninja detected, using it for faster builds."
    GENERATOR_ARGS="-G Ninja"
else
    echo "Ninja not found, falling back to system default generator."
fi

cd "$BUILD_DIR"
cmake $GENERATOR_ARGS \
      -DCMAKE_BUILD_TYPE=Release \
      -DFETCHCONTENT_BASE_DIR="$DEPS_DIR" \
      ..

cmake --build . --parallel "$(nproc)"

echo "Release build finished successfully."
