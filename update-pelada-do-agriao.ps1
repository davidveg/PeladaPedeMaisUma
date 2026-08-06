[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateNotNullOrEmpty()]
    [string]$Message
)

$mobilePath = Join-Path $PSScriptRoot "mobile"

if (-not (Test-Path -LiteralPath (Join-Path $mobilePath "package.json"))) {
    throw "A pasta mobile não foi encontrada em: $mobilePath"
}

$env:EXPO_APP_VARIANT = "agriao"
$env:EXPO_APP_NAME = "Pelada do Agrião"
$env:EXPO_APP_SLUG = "pelada-do-agriao"
$env:EXPO_APP_SCHEME = "peladadoagriao"
$env:EXPO_ANDROID_PACKAGE = "br.com.peladadoagriao.app"
$env:EXPO_IOS_BUNDLE_IDENTIFIER = "br.com.peladadoagriao.app"
$env:EXPO_EAS_PROJECT_ID = "5c7cc851-84df-4e97-8405-35091dc56fa0"
$env:EXPO_UPDATES_URL = "https://u.expo.dev/5c7cc851-84df-4e97-8405-35091dc56fa0"
$env:EXPO_OWNER = "davidvegabr"

$env:EXPO_PUBLIC_API_BASE_URL = "https://peladadoagriao.vegaalameda.com"
$env:EXPO_PUBLIC_WEB_BASE_URL = "https://peladadoagriao.vegaalameda.com"
$env:EXPO_PUBLIC_APP_ENV = "preview"

$env:EXPO_APP_ICON = "./assets/icon-agriao.png"
$env:EXPO_ADAPTIVE_ICON = "./assets/icon-agriao.png"
$env:EXPO_NOTIFICATION_ICON = "./assets/icon-agriao.png"
$env:EXPO_GOOGLE_SERVICES_FILE = "./google-services-agriao.json"
$env:EXPO_PRIMARY_COLOR = "#0B3D2E"

Push-Location -LiteralPath $mobilePath
try {
    & npx.cmd eas-cli@latest update `
        --channel preview `
        --environment preview `
        --platform android `
        --message $Message

    if ($LASTEXITCODE -ne 0) {
        throw "O EAS Update terminou com o código de erro $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
