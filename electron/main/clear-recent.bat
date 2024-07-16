@echo off
del /F /Q %APPDATA%\Microsoft\Windows\Recent\AutomaticDestinations\*
del /F /Q %APPDATA%\Microsoft\Windows\Recent\CustomDestinations\*
del /F /Q %APPDATA%\Microsoft\Windows\Recent\*
taskkill /f /im explorer.exe
start explorer.exe