@echo off
del /F /Q %APPDATA%\Microsoft\Windows\Recent\AutomaticDestinations\*
del /F /Q %APPDATA%\Microsoft\Windows\Recent\CustomDestinations\*
del /F /Q %APPDATA%\Microsoft\Windows\Recent\*
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Office\16.0\Excel\User MRU" /f
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Office\16.0\Excel\File MRU" /f
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Office\16.0\Word\User MRU" /f
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Office\16.0\Word\File MRU" /f
taskkill /f /im explorer.exe
start explorer.exe