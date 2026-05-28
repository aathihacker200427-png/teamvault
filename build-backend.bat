@echo off
set MINGW_PATH=C:\Users\Sakthi\AppData\Local\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin
set PATH=%MINGW_PATH%;%PATH%

cd /d D:\Strucureo\internal\backend
C:\Users\Sakthi\.cargo\bin\cargo.exe build --release
