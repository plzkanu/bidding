# Hancom HWP security module installer (removes file-access prompts)
# 1) Download Automation security zip from https://developer.hancom.com/hwpautomation
# 2) Copy FilePathCheckerModuleExample.dll to scripts\hwp-security\
# 3) Run this script

$ErrorActionPreference = "Stop"
$securityDir = Join-Path $PSScriptRoot "hwp-security"

if (-not (Test-Path $securityDir)) {
    New-Item -ItemType Directory -Path $securityDir | Out-Null
}

$dll = Get-ChildItem -Path $securityDir -Filter "FilePathChecker*.dll" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $dll) {
    Write-Host "[ERROR] Security DLL not found." -ForegroundColor Yellow
    Write-Host "Place FilePathCheckerModuleExample.dll in:" -ForegroundColor Yellow
    Write-Host "  $securityDir" -ForegroundColor Yellow
    Write-Host "Download: https://developer.hancom.com/hwpautomation" -ForegroundColor Cyan
    exit 1
}

Write-Host "DLL: $($dll.FullName)"
python (Join-Path $PSScriptRoot "install_hwp_security.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "[OK] Security module registered. Restart dev server and retry summary." -ForegroundColor Green
