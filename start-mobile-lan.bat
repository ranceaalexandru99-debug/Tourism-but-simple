@echo off
REM No enabledelayedexpansion: the project path ends with "!" which delayed
REM expansion would strip. Also: NO parentheses inside any echo text, because a
REM ")" inside an if(...) block closes the block early and crashes the script.
setlocal
title VoyageAI Native - Expo Go LAN

cd /d "%~dp0mobile-native"
if errorlevel 1 goto badpath

echo.
echo ========================================================================
echo   VoyageAI native - Expo Go LAN mode
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

echo [*] Your PC IPv4 addresses - the phone must reach one of these:
REM Match just "IPv4" so it works on English and Romanian Windows alike.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do echo      %%a
echo.
echo   Phone and PC must be on the SAME Wi-Fi. Allow the Windows Firewall
echo   prompt if it appears - both Private and Public.
echo.

if exist "node_modules" goto haveModules
echo [*] Installing dependencies - one-time, a few minutes...
call npm install
if errorlevel 1 goto npmfail
echo.

:haveModules
echo [*] Starting Expo in LAN mode. Metro takes 10-30s on first run.
echo     Scan the QR with Expo Go when it appears. Ctrl+C to stop.
echo ========================================================================
echo.
REM Free a stuck Metro port from a previous run that was closed with the
REM window X instead of Ctrl+C, so a second launch does not fail with
REM "port 8081 already in use". No delayed expansion needed (%%p is literal).
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081 " ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>&1
call npx expo start --lan --clear
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
