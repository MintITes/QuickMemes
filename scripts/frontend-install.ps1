$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendDir = Join-Path $ScriptDir "..\src\frontend"
$FrontendDir = [IO.Path]::GetFullPath($FrontendDir)

Write-Host "Installing frontend dependencies..."
Push-Location $FrontendDir
try {
    npm install
} finally {
    Pop-Location
}
Write-Host "Dependencies installed."
