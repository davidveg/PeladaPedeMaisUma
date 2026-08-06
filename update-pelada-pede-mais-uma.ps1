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

$env:EXPO_APP_VARIANT = "default"
$env:EXPO_APP_NAME = "Pelada Pede Mais Uma"
$env:EXPO_APP_SLUG = "pelada-pede-mais-uma"
$env:EXPO_APP_SCHEME = "peladapedemaisuma"
$env:EXPO_ANDROID_PACKAGE = "br.com.peladapedemaisuma.app"
$env:EXPO_IOS_BUNDLE_IDENTIFIER = "br.com.peladapedemaisuma.app"
$env:EXPO_EAS_PROJECT_ID = "00374e15-c3c9-46fd-ab57-ebb23ee01635"
$env:EXPO_UPDATES_URL = "https://u.expo.dev/00374e15-c3c9-46fd-ab57-ebb23ee01635"
$env:EXPO_OWNER = "davidvegabr"

$env:EXPO_PUBLIC_API_BASE_URL = "https://pedemaisuma.vegaalameda.com"
$env:EXPO_PUBLIC_WEB_BASE_URL = "https://pedemaisuma.vegaalameda.com"
$env:EXPO_PUBLIC_APP_ENV = "preview"

$env:EXPO_APP_ICON = "./assets/icon-football-beer.png"
$env:EXPO_ADAPTIVE_ICON = "./assets/adaptive-icon-football-beer.png"
$env:EXPO_NOTIFICATION_ICON = "./assets/adaptive-icon-football-beer.png"
$env:EXPO_GOOGLE_SERVICES_FILE = "./google-services.json"
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
