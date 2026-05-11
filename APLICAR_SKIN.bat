@echo off
set EXE=%~dp0scratch\YtdPatcher\bin\Debug\net9.0-windows\YtdPatcher.exe

if "%~1"=="" (
    echo LHC YtdPatcher - Instrucciones:
    echo   1. Descarga el DDS desde LHC SkinForge web
    echo   2. Arrastra el .dds encima de este .bat
    echo   3. El RPF se copia a FiveM mods automaticamente
    echo.
    "%EXE%"
    pause
    exit /b
)

set DDS=%~1
set BASENAME=%~n1

REM Quitar sufijo _custom (ej: w_pi_combatpistol_custom -> w_pi_combatpistol)
for /f "tokens=1 delims=_c" %%A in ("%BASENAME%") do set WEAPON=%%A
powershell -command "$n='%BASENAME%'; $n=$n -replace '_custom$',''; $n=$n -replace '_custom\.','.'; [System.IO.File]::WriteAllText('%TEMP%\wpname.txt',$n)"
set /p WEAPON=<%TEMP%\wpname.txt

echo.
echo DDS:  %DDS%
echo Arma: %WEAPON%
echo.

"%EXE%" "%DDS%" "%WEAPON%"

if %ERRORLEVEL%==0 (
    echo.
    echo OK - RPF generado. Inicia FiveM para ver el skin.
) else (
    echo.
    echo ERROR al generar el RPF.
)
echo.
pause
