@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo First run: installing dependencies. Keep the network connected...
  call npm.cmd install
  if errorlevel 1 goto error
)
if not exist "dist\index.html" (
  echo Building Tavern Atelier...
  call npm.cmd run build
  if errorlevel 1 goto error
)
start "Tavern Atelier" /d "%~dp0" "node_modules\electron\dist\electron.exe" .
exit /b 0
:error
echo.
echo Startup failed. Install Node.js and review the error above.
pause
exit /b 1
