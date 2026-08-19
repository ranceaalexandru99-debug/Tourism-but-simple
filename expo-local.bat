@echo off
REM Minimal launcher for the native Expo app in LAN mode (same Wi-Fi).
REM No goto/labels, no parens, no delayed expansion - nothing that can
REM mis-parse. cmd /k keeps the window open even if Expo exits or errors.
title VoyageAI - Expo local
cd /d "%~dp0mobile-native"
echo.
echo === Starting Expo (LAN) in %CD% ===
echo Scan the QR with Expo Go. Window stays open. Close it to stop.
echo.
cmd /k npx expo start --lan
