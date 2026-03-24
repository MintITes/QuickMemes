$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendDir = Join-Path $ScriptDir "..\src\frontend"
$FrontendDir = [IO.Path]::GetFullPath($FrontendDir)

Push-Location $FrontendDir
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "Dependencies not found. Running npm ci..."
        npm ci --no-audit --prefer-offline
    }

    Write-Host "Running Frontend Vitest Suite..."
    if ($env:GITHUB_ACTIONS -eq "true" -or $env:CI -eq "true") {
        $ReportDir = Join-Path $FrontendDir "test-results"
        New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
        npm run test:run -- --reporter=default --reporter=json --outputFile="$ReportDir/vitest-report.json"
    } else {
        npm run test:run
    }

    Write-Host "Tests Passed."
} finally {
    Pop-Location
}
