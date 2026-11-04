# First-time setup wizard (Windows PowerShell). Only checks that Node.js exists, then runs setup.mjs.
# Nothing is downloaded or installed unless you choose it inside the wizard.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js 20 or newer is needed and was not found."
    Write-Host "  Install it from https://nodejs.org   or run:  winget install OpenJS.NodeJS.LTS"
    Write-Host "Then run .\setup.ps1 again. Nothing was changed."
    exit 1
}
& node (Join-Path $PSScriptRoot 'setup.mjs') @args
exit $LASTEXITCODE
