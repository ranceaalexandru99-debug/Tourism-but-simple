@echo off
REM No enabledelayedexpansion the project path ends with "!". No parentheses in
REM any echo text a ")" inside an if(...) block closes it early and crashes.
setlocal
title VoyageAI Native - Expo Go tunnel

cd /d "%~dp0mobile-native"
if errorlevel 1 goto badpath

echo.
echo ========================================================================
echo   VoyageAI native - Expo Go tunnel mode
echo ========================================================================
echo.
echo [*] Working dir: %CD%
echo.

where node >nul 2>&1
if errorlevel 1 goto nonode

echo [*] Node / npm versions:
node -v
call npm -v
echo.

if exist "node_modules" goto haveModules
echo [*] Installing dependencies - one-time, a few minutes...
call npm install
if errorlevel 1 goto npmfail
echo.

:haveModules
echo [*] Starting Expo with a public tunnel. First boot takes 20-40s.
echo     Works over any network. Scan the QR with Expo Go. Ctrl+C to stop.
echo ========================================================================
echo.
REM Free a stuck Metro port from a previous run that was closed with the
REM window X instead of Ctrl+C, so a second launch does not fail with
REM "port 8081 already in use". No delayed expansion needed (%%p is literal).
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081 " ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>&1
call npx expo start --tunnel --clear
goto done

:badpath
echo [ERROR] Could not find the mobile-native folder next to this file.
echo         Looked in: %~dp0
goto done

:nonode
echo [ERROR] Node.js is not on PATH. Install the LTS from https://nodejs.org/
goto done

:npmfail
echo [ERROR] npm install failed. See the errors above.

:done
echo.
pause
endlocal
