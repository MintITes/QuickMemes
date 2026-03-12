$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendDir = Join-Path $ScriptDir "..\src\frontend"
$FrontendDir = [IO.Path]::GetFullPath($FrontendDir)

Push-Location $FrontendDir
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "Dependencies not found. Running npm install..."
        npm install
    }

    Write-Host "Running Frontend Linter (ESLint)..."
    npm run lint

    Write-Host "Linter Check Passed."
} finally {
    Pop-Location
}
