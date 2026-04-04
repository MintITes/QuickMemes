$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "..\src\backend"
$BackendDir = [IO.Path]::GetFullPath($BackendDir)
$BuildDir = Join-Path $BackendDir "build"

Write-Host "Running build.ps1 -Test ..."
& (Join-Path $ScriptDir "build.ps1") -Test

Write-Host "Running perf tests..."
$PerfBin = Join-Path $BuildDir "tests\quickmemes_perf_tests"
if ($env:GITHUB_ACTIONS -eq "true" -or $env:CI -eq "true") {
    New-Item -ItemType Directory -Force -Path (Join-Path $BuildDir "Testing") | Out-Null
    $PerfXml = Join-Path $BuildDir "Testing\perf-junit.xml"
    & $PerfBin "--gtest_brief=1" "--gtest_print_time=0" "--gtest_output=xml:$PerfXml"
} else {
    & $PerfBin "--gtest_brief=1" "--gtest_print_time=0"
}

Write-Host "Perf tests passed successfully."
