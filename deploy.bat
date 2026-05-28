@echo off
REM TeamVault Production Deploy Script (Windows)
REM Developed by Strucureo - https://strucureo.com

echo ================================================
echo   TeamVault - by Strucureo
echo   Production Deployment
echo ================================================
echo.

REM Check Docker
where docker >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Docker is not installed.
    exit /b 1
)
echo [OK] Docker is ready

REM Generate .env if missing
if not exist .env (
    echo [INFO] Generating .env with secure random secrets...
    powershell -Command "$jwt=[Convert]::ToBase64String((1..48 ^| %% { Get-Random -Maximum 256 })) -replace '[+/=]','x'; $pg=[Convert]::ToBase64String((1..32 ^| %% { Get-Random -Maximum 256 })) -replace '[+/=]','x'; $sfu=[Convert]::ToBase64String((1..24 ^| %% { Get-Random -Maximum 256 })) -replace '[+/=]','x'; $env_content = \"POSTGRES_USER=teamvault`nPOSTGRES_PASSWORD=$pg`nPOSTGRES_DB=teamvault`nDATABASE_URL=postgresql://teamvault:$pg@postgres:5432/teamvault`nJWT_SECRET=$jwt`nJWT_EXPIRATION_HOURS=24`nCORS_ORIGIN=http://localhost`nRUST_LOG=info`nSFU_URL=http://sfu:8080`nSFU_SECRET=$sfu`nVITE_API_URL=/api/v1`nTURN_REALM=teamvault.local`nTURN_USER=turnuser`nTURN_PASSWORD=$sfu\"; Set-Content -Path .env -Value $env_content"
    echo [OK] Generated .env
) else (
    echo [OK] Using existing .env
)

echo.
echo Building images...
docker compose build

echo.
echo Starting services...
docker compose up -d --remove-orphans

echo.
echo Waiting for services...
timeout /t 15 /nobreak >nul

echo.
echo ================================================
echo   TeamVault is running!
echo ================================================
echo.
echo   Open: http://localhost:8080
echo.
echo   Manage:
echo     Status: docker compose ps
echo     Logs:   docker compose logs -f
echo     Stop:   docker compose down
echo.
echo   TeamVault by Strucureo - https://strucureo.com
echo.
