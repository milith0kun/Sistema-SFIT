<#
.SYNOPSIS
  Lanza el emulador Android y fija siempre la misma ubicación GPS.

.DESCRIPTION
  Reemplaza a `flutter emulators --launch <id>`. Hace:
    1. Lanza el AVD indicado (o el primero disponible si no se pasa -Avd).
    2. Espera a que el emulador termine de bootear (sys.boot_completed).
    3. Envía `adb emu geo fix <lng> <lat>` al emulador.

  Por defecto usa la ubicación FIJA del propietario del proyecto (definida
  en $DefaultLat/$DefaultLng). Si pasas `-AutoDetect`, intenta detectar la
  ubicación actual del PC en este orden:
    a) Windows Location Service (preciso si está habilitado).
    b) IP geolocation vía ipapi.co (precisión ~ciudad).
    c) Si todo falla, cae a la fija.

.PARAMETER Avd
  Nombre del AVD a lanzar. Default: primer emulador de `flutter emulators`.

.PARAMETER Lat
  Latitud a fijar. Default: la fija del proyecto.

.PARAMETER Lng
  Longitud a fijar. Default: la fija del proyecto.

.PARAMETER AutoDetect
  Si está presente, intenta detectar la ubicación real (Windows → IP).

.EXAMPLE
  # Comportamiento normal: siempre la misma ubicación fija.
  .\emu-with-location.ps1

  # Override puntual.
  .\emu-with-location.ps1 -Lat -12.0464 -Lng -77.0428

  # Detectar al vuelo.
  .\emu-with-location.ps1 -AutoDetect
#>

[CmdletBinding()]
param(
  [string]$Avd = "",
  [double]$Lat = [double]::NaN,
  [double]$Lng = [double]::NaN,
  [switch]$AutoDetect
)

# Ubicación fija del propietario del proyecto. Cambia estos dos valores si
# te mudas y quieres un nuevo "siempre". Comportamiento por defecto: el
# emulador SIEMPRE arranca con estas coordenadas.
$DefaultLat = -13.500286
$DefaultLng = -72.028383

$ErrorActionPreference = "Stop"

# adb suele no estar en PATH en setups Windows fresh — buscamos las
# ubicaciones estándar del Android SDK y guardamos el path en $script:Adb.
function Resolve-Adb {
  # 1) PATH actual.
  $cmd = Get-Command adb -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  # 2) Ubicaciones típicas en Windows.
  $candidates = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
    "$env:ANDROID_HOME\platform-tools\adb.exe",
    "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe",
    "C:\Program Files\Android\Android Studio\platform-tools\adb.exe",
    "$env:USERPROFILE\AppData\Local\Android\Sdk\platform-tools\adb.exe"
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  return $null
}

$script:Adb = Resolve-Adb
if (-not $script:Adb) {
  Write-Error "No encuentro adb.exe. Instala Android SDK platform-tools o define `$env:ANDROID_HOME."
  exit 4
}

function Get-LocationFromWindows {
  try {
    Add-Type -AssemblyName System.Device -ErrorAction Stop
    $watcher = New-Object System.Device.Location.GeoCoordinateWatcher
    $watcher.Start() | Out-Null
    # GeoCoordinateWatcher tarda algunos segundos en obtener fix.
    $deadline = (Get-Date).AddSeconds(8)
    while ((Get-Date) -lt $deadline -and $watcher.Status -ne "Ready") {
      Start-Sleep -Milliseconds 250
    }
    if ($watcher.Status -eq "Ready" -and -not $watcher.Position.Location.IsUnknown) {
      $loc = $watcher.Position.Location
      $watcher.Stop()
      return [pscustomobject]@{
        Source = "Windows Location Service"
        Lat    = [double]$loc.Latitude
        Lng    = [double]$loc.Longitude
      }
    }
    $watcher.Stop()
  } catch {
    # Permisos de ubicación denegados, servicio no disponible, etc.
  }
  return $null
}

function Get-LocationFromIp {
  try {
    $resp = Invoke-RestMethod -Uri "https://ipapi.co/json/" -TimeoutSec 8
    if ($resp.latitude -and $resp.longitude) {
      return [pscustomobject]@{
        Source = "IP geolocation ($($resp.city), $($resp.country_code))"
        Lat    = [double]$resp.latitude
        Lng    = [double]$resp.longitude
      }
    }
  } catch {
    # Sin internet o ipapi.co caído.
  }
  return $null
}

function Get-Location {
  param(
    [bool]$Auto,
    [double]$OverrideLat,
    [double]$OverrideLng,
    [double]$DefaultLat,
    [double]$DefaultLng
  )
  # 1) Coordenadas explícitas pasadas por argumento → ganan sobre todo.
  if (-not [double]::IsNaN($OverrideLat) -and -not [double]::IsNaN($OverrideLng)) {
    return [pscustomobject]@{
      Source = "Override (-Lat/-Lng)"
      Lat    = $OverrideLat
      Lng    = $OverrideLng
    }
  }
  # 2) Detección automática solo si se pidió expresamente.
  if ($Auto) {
    $loc = Get-LocationFromWindows
    if ($null -ne $loc) { return $loc }
    $loc = Get-LocationFromIp
    if ($null -ne $loc) { return $loc }
  }
  # 3) Default: la ubicación fija del proyecto.
  return [pscustomobject]@{
    Source = "Default fija del proyecto"
    Lat    = $DefaultLat
    Lng    = $DefaultLng
  }
}

function Get-FirstAvd {
  # `flutter emulators` formatea con bullet (•) que en algunos encodings
  # de la consola Windows llega corrupto. En vez de depender del bullet,
  # buscamos líneas que terminen en "android" y NO sean el header "Id ...".
  $output = & flutter emulators 2>&1 | Out-String
  foreach ($line in ($output -split "`n")) {
    $trimmed = $line.Trim()
    if ($trimmed -match "android\s*$" -and $trimmed -notmatch "^Id\b") {
      # Primer token de la línea = el ID del AVD.
      $first = ($trimmed -split "\s")[0]
      if ($first) { return $first }
    }
  }
  return $null
}

function Wait-EmulatorBoot {
  param([int]$TimeoutSec = 180)
  Write-Host "  Esperando que el emulador termine de bootear..." -ForegroundColor DarkGray
  & $script:Adb wait-for-device 2>&1 | Out-Null
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $boot = & $script:Adb shell getprop sys.boot_completed 2>&1
    if ($boot -match "^1") { return $true }
    Start-Sleep -Seconds 2
  }
  return $false
}

# ── Main ────────────────────────────────────────────────────────────────

if ([string]::IsNullOrWhiteSpace($Avd)) {
  $Avd = Get-FirstAvd
  if (-not $Avd) {
    Write-Error "No se encontraron AVDs. Lista los disponibles con: flutter emulators"
    exit 1
  }
  Write-Host "AVD no especificado; usando '$Avd'." -ForegroundColor DarkGray
}

# Si ya hay un emulador corriendo, no lanzamos otro — solo refrescamos GPS.
$running = & $script:Adb devices 2>&1 | Select-String "emulator-\d+\s+device"
if ($running) {
  Write-Host "Emulador ya está corriendo. Solo actualizo ubicación." -ForegroundColor Yellow
} else {
  Write-Host "Lanzando AVD: $Avd" -ForegroundColor Cyan
  Start-Process -FilePath "flutter" -ArgumentList @("emulators", "--launch", $Avd) `
    -NoNewWindow -PassThru | Out-Null
  if (-not (Wait-EmulatorBoot -TimeoutSec 180)) {
    Write-Error "El emulador no terminó de bootear en 180 s."
    exit 2
  }
  Write-Host "  Emulador listo." -ForegroundColor Green
}

# Resuelve la ubicación a aplicar y la envía al emulador.
Write-Host "Resolviendo ubicación..." -ForegroundColor Cyan
$loc = Get-Location `
  -Auto:$AutoDetect.IsPresent `
  -OverrideLat $Lat `
  -OverrideLng $Lng `
  -DefaultLat $DefaultLat `
  -DefaultLng $DefaultLng
$latStr = $loc.Lat.ToString([System.Globalization.CultureInfo]::InvariantCulture)
$lngStr = $loc.Lng.ToString([System.Globalization.CultureInfo]::InvariantCulture)
Write-Host ("  Fuente : {0}" -f $loc.Source) -ForegroundColor DarkGray
Write-Host ("  Lat/Lng: {0}, {1}" -f $latStr, $lngStr) -ForegroundColor DarkGray

# `adb emu geo fix` toma <longitude> <latitude> en ese orden (no al revés).
& $script:Adb emu geo fix $lngStr $latStr | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Ubicación fijada en el emulador." -ForegroundColor Green
} else {
  Write-Error "adb emu geo fix falló (exit=$LASTEXITCODE)."
  exit 3
}
