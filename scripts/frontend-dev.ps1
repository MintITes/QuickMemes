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

    Write-Host "Starting Frontend Development Server..."
    npm run dev
} finally {
    Pop-Location
}
