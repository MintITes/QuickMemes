param(
    [switch]$Clean,
    [switch]$Test
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "..\src\backend"
$BackendDir = [IO.Path]::GetFullPath($BackendDir)
$BuildDir = Join-Path $BackendDir "build"
$DepsDir = Join-Path $BackendDir ".deps"

if ($Clean) {
    Write-Host "Cleaning build and deps directory..."
    if (Test-Path $BuildDir) { Remove-Item -Recurse -Force $BuildDir }
    if (Test-Path $DepsDir) { Remove-Item -Recurse -Force $DepsDir }
}

if ($Test) {
    Write-Host "Cleaning test artifacts..."
    $TestsDir = Join-Path $BuildDir "tests"
    $TestingDir = Join-Path $BuildDir "Testing"
    if (Test-Path $TestsDir) #{ Remove-Item -Recurse -Force $TestsDir }
    if (Test-Path $TestingDir) { Remove-Item -Recurse -Force $TestingDir }
}

Write-Host "Building QuickMemes Backend (Incremental)..."
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
New-Item -ItemType Directory -Force -Path $DepsDir | Out-Null

$generatorArgs = @()
if (Get-Command ninja -ErrorAction SilentlyContinue) {
    Write-Host "Ninja detected, using it for faster builds."
    $generatorArgs += "-G"
    $generatorArgs += "Ninja"
} else {
    Write-Host "Ninja not found, falling back to system default generator."
}

$cmakeArgs = @()
$cmakeArgs += $generatorArgs
$cmakeArgs += "-DCMAKE_BUILD_TYPE=Debug"
$cmakeArgs += "-DFETCHCONTENT_BASE_DIR=$DepsDir"
$cmakeArgs += "-S"
$cmakeArgs += $BackendDir
$cmakeArgs += "-B"
$cmakeArgs += $BuildDir

if ($env:GITHUB_ACTIONS -eq "true") {
    Write-Host "Running inside GitHub Actions. Injecting OpenSSL path..."
    $cmakeArgs += "-DCMAKE_TOOLCHAIN_FILE=C:/vcpkg/scripts/buildsystems/vcpkg.cmake"
#    $cmakeArgs += "-DOPENSSL_INCLUDE_DIR=C:\Program Files\OpenSSL-Win64\include"
#    $cmakeArgs += "-DOPENSSL_CRYPTO_LIBRARY=C:\Program Files\OpenSSL-Win64\lib"
}

& cmake @cmakeArgs

$cpuCount = [Environment]::ProcessorCount
& cmake --build $BuildDir --parallel $cpuCount --config Debug

Write-Host "Build finished successfully."
