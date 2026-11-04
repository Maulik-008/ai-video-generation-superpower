@echo off
rem First-time setup wizard (Windows, Command Prompt). Only checks that Node.js exists, then runs setup.mjs.
rem Nothing is downloaded or installed unless you choose it inside the wizard.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is needed and was not found.
  echo   Install it from https://nodejs.org   or run:  winget install OpenJS.NodeJS.LTS
  echo Then run setup.cmd again. Nothing was changed.
  exit /b 1
)
node "%~dp0setup.mjs" %*
exit /b %errorlevel%
