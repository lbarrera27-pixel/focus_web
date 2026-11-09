# =====================================================================
#  Focus! - Credenciales SMTP de Azure Communication Services
#  Crea la identidad "focus-api-smtp", le da permiso SOLO sobre el
#  recurso de correo y guarda su clave en la API. La clave no se muestra.
# =====================================================================
$g = 'rg-focus'
$c = 'focus-comm-luisbb27'
$w = 'focus-api-luisbb27'
$t = 'c71bb3d4-3ed1-4905-8eda-db30e0f896b5'
$dom = 'b7171504-a41c-4f1b-944e-bcb44b46d8fe.azurecomm.net'

function Revisar($paso) {
    if ($LASTEXITCODE -ne 0) { Write-Host "Fallo: $paso" -ForegroundColor Red; exit 1 }
    Write-Host "OK: $paso" -ForegroundColor Green
}

$app = az ad app list --display-name focus-api-smtp --query "[0].appId" -o tsv
if (-not $app) { $app = az ad app create --display-name focus-api-smtp --query appId -o tsv }
Revisar "identidad"

$oid = az ad sp show --id $app --query id -o tsv 2>$null
if (-not $oid) { $oid = az ad sp create --id $app --query id -o tsv }
Revisar "service principal"

$scope = az communication show -n $c -g $g --query id -o tsv
Revisar "recurso de correo"

# La identidad recien creada puede tardar en aparecer: se reintenta
for ($i = 1; $i -le 8; $i++) {
    az role assignment create --assignee-object-id $oid --assignee-principal-type ServicePrincipal --role "Communication and Email Service Owner" --scope $scope -o none
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep 15
}
Revisar "permiso sobre el recurso de correo"

$clave = az ad app credential reset --id $app --years 2 --query password -o tsv
Revisar "clave"

az webapp config appsettings set -g $g -n $w --settings SMTP_HOST=smtp.azurecomm.net SMTP_PORT=587 "SMTP_USUARIO=$c.$app.$t" "SMTP_PASSWORD=$clave" "SMTP_REMITENTE=DoNotReply@$dom" -o none
Revisar "ajustes de la API"
Remove-Variable clave

Write-Host "Listo. Ya puedes volver al chat." -ForegroundColor Cyan
