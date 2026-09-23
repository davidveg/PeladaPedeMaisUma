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

$env:EXPO_APP_VARIANT = "peladix"
$env:EXPO_APP_NAME = "Peladix"
$env:EXPO_APP_SLUG = "pelada-peladix"
$env:EXPO_APP_SCHEME = "peladix"
$env:EXPO_ANDROID_PACKAGE = "br.com.peladix.app"
$env:EXPO_IOS_BUNDLE_IDENTIFIER = "br.com.peladix.app"
$env:EXPO_EAS_PROJECT_ID = "4a4cf359-9c40-43b8-93bd-57a2ab53aa43"
$env:EXPO_UPDATES_URL = "https://u.expo.dev/4a4cf359-9c40-43b8-93bd-57a2ab53aa43"
$env:EXPO_OWNER = "davidvegabr"

$env:EXPO_PUBLIC_API_BASE_URL = "https://peladix.vegaalameda.com"
$env:EXPO_PUBLIC_WEB_BASE_URL = "https://peladix.vegaalameda.com"
$env:EXPO_PUBLIC_APP_ENV = "preview"

$env:EXPO_APP_ICON = "./assets/icon-peladix.png"
$env:EXPO_ADAPTIVE_ICON = "./assets/adaptive-icon-peladix.png"
$env:EXPO_NOTIFICATION_ICON = "./assets/notification-icon-peladix.png"
$env:EXPO_GOOGLE_SERVICES_FILE = "./google-services-peladix.json"
$env:EXPO_PRIMARY_COLOR = "#440052"
$env:EXPO_ADAPTIVE_BACKGROUND_COLOR = "#FFFFFF"

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
