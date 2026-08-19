@echo off
REM Turism, dar simplu! - Control Panel launcher.
REM Double-click this. It opens a small window with Start/Stop/Browser buttons
REM and a live log of the Vite dev server. No enabledelayedexpansion (the path
REM ends in "!"); no parentheses inside echo text.
title Turism, dar simplu! - Control Panel

where node >nul 2>&1
if errorlevel 1 goto nonode

REM Launch the WinForms GUI. -Sta is required: WinForms (RichTextBox, Clipboard)
REM needs a single-threaded apartment or the window crashes on show. -File
REM handles the spaces + "!" in the path fine while delayed expansion is OFF.
powershell -NoProfile -ExecutionPolicy Bypass -Sta -WindowStyle Hidden -File "%~dp0server-gui.ps1"
goto done

:nonode
echo [ERROR] Node.js is not on PATH. Install the LTS from https://nodejs.org/
pause

:done
