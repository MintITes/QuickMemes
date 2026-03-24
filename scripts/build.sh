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

if [[ "$(uname -s)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
    OPENSSL_ROOT_DIR="$(brew --prefix openssl@3 2>/dev/null || true)"
    if [ -n "$OPENSSL_ROOT_DIR" ]; then
        echo "Using Homebrew OpenSSL at $OPENSSL_ROOT_DIR"
        GENERATOR_ARGS="$GENERATOR_ARGS -DOPENSSL_ROOT_DIR=$OPENSSL_ROOT_DIR"
    fi
fi

cpu_count() {
    if command -v nproc >/dev/null 2>&1; then
        nproc
        return
    fi

    if command -v getconf >/dev/null 2>&1; then
        getconf _NPROCESSORS_ONLN 2>/dev/null && return
    fi

    if command -v sysctl >/dev/null 2>&1; then
        sysctl -n hw.ncpu 2>/dev/null && return
    fi

    echo 2
}

# Generate build files
# Using -DFETCHCONTENT_BASE_DIR to keep dependency sources outside of the build folder
cd "$BUILD_DIR"
cmake $GENERATOR_ARGS \
      -DCMAKE_BUILD_TYPE=Debug \
      -DFETCHCONTENT_BASE_DIR="$DEPS_DIR" \
      ..

# Build
cmake --build . --parallel "$(cpu_count)"

echo "Build finished successfully."
