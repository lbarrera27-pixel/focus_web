# =====================================================================
#  Focus! - Paso 2: subir la API FastAPI a Azure App Service
#  Empaqueta solo lo necesario (main.py, app/, requirements.txt) y lo
#  despliega; Azure instala las dependencias (Oryx) y arranca gunicorn.
# =====================================================================
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\config.ps1"

$temporal = Join-Path $env:TEMP "focus-api-deploy"
$zip = Join-Path $env:TEMP "focus-api.zip"
if (Test-Path $temporal) { Remove-Item $temporal -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }
New-Item -ItemType Directory $temporal | Out-Null

Copy-Item (Join-Path $RaizRepo "main.py") $temporal
Copy-Item (Join-Path $RaizRepo "requirements.txt") $temporal
Copy-Item (Join-Path $RaizRepo "app") $temporal -Recurse
Get-ChildItem $temporal -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
# Compress-Archive (PowerShell 5.1) guarda las rutas con "\" y en Linux la carpeta app/ no aparece;
# tar.exe (incluido en Windows 10+) genera el zip con "/".
tar.exe -a -c -f $zip -C $temporal main.py requirements.txt app
if ($LASTEXITCODE -ne 0) { throw "Fallo al crear el zip" }

Write-Host "==> Desplegando a $WebApp (tarda 2-5 minutos la primera vez)..." -ForegroundColor Cyan
az webapp deploy -g $Grupo -n $WebApp --src-path $zip --type zip --track-status false
if ($LASTEXITCODE -ne 0) { throw "Fallo el despliegue" }
# Si un arranque anterior fallo, Azure deja el sitio detenido
az webapp start -g $Grupo -n $WebApp -o none
# A veces el contenedor sigue con el codigo anterior: se reinicia para que tome el zip nuevo
az webapp restart -g $Grupo -n $WebApp -o none

$url = "https://$WebApp.azurewebsites.net"
Write-Host "`nProbando $url/salud (la base serverless puede tardar ~1 min en despertar)..."
for ($i = 1; $i -le 12; $i++) {
    try {
        $r = Invoke-RestMethod "$url/salud" -TimeoutSec 60
        Write-Host ("Respuesta: " + ($r | ConvertTo-Json -Compress)) -ForegroundColor Green
        Write-Host "Swagger: $url/docs"
        exit 0
    } catch { Write-Host "  intento $i/12: aun no responde, esperando 20 s..."; Start-Sleep 20 }
}
Write-Warning "No respondio todavia. Revisa los logs con:  az webapp log tail -g $Grupo -n $WebApp"
