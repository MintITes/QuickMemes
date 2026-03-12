$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "..\src\backend"
$BackendDir = [IO.Path]::GetFullPath($BackendDir)
$BuildDir = Join-Path $BackendDir "build"

Write-Host "Running build.ps1 -Test ..."
& (Join-Path $ScriptDir "build.ps1") -Test

Write-Host "Running tests..."
$cpuCount = [Environment]::ProcessorCount
Push-Location $BuildDir
try {
    & ctest --output-on-failure --parallel $cpuCount -V -C Debug
} finally {
    Pop-Location
}

Write-Host "Tests passed successfully."
