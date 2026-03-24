#!/usr/bin/env bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
DIR="$( cd "$SCRIPT_DIR"/../src/backend >/dev/null 2>&1 && pwd )"
BUILD_DIR="$DIR/build"

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

echo "Running build.sh clean test..."
"$SCRIPT_DIR/build.sh" --test

echo "Running tests..."
cd "$BUILD_DIR"
if [ "${GITHUB_ACTIONS:-}" = "true" ] || [ "${CI:-}" = "true" ]; then
    mkdir -p "$BUILD_DIR/Testing"
    ctest --output-on-failure --parallel "$(cpu_count)" -V --output-junit "$BUILD_DIR/Testing/ctest-junit.xml"
else
    ctest --output-on-failure --parallel "$(cpu_count)" -V
fi

echo "Tests passed successfully."
