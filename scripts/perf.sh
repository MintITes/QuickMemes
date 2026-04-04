#!/usr/bin/env bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
DIR="$( cd "$SCRIPT_DIR"/../src/backend >/dev/null 2>&1 && pwd )"
BUILD_DIR="$DIR/build"

echo "Running build.sh clean test..."
"$SCRIPT_DIR/build.sh" --test

echo "Running perf tests..."
cd "$BUILD_DIR"
PERF_BIN="$BUILD_DIR/tests/quickmemes_perf_tests"
if [ "${GITHUB_ACTIONS:-}" = "true" ] || [ "${CI:-}" = "true" ]; then
    mkdir -p "$BUILD_DIR/Testing"
    "$PERF_BIN" --gtest_brief=1 --gtest_print_time=0 --gtest_output=xml:"$BUILD_DIR/Testing/perf-junit.xml"
else
    "$PERF_BIN" --gtest_brief=1 --gtest_print_time=0
fi

echo "Perf tests passed successfully."
