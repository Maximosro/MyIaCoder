<#
.SYNOPSIS
  Builds a self-contained embedded Python for the voice STT sidecar, so the
  installer ships everything and the target machine needs no Python.

.DESCRIPTION
  Downloads the official Windows "embeddable" Python, enables site-packages,
  bootstraps pip, and installs the sidecar requirements as their normal pip
  wheels (NOT repackaged) — which is why native libs like CTranslate2 work,
  unlike a PyInstaller-frozen build. Also copies the sidecar script next to it.

  Output: sidecar-dist/python/  (python.exe + Lib/site-packages + deps)
          sidecar-dist/voice_sidecar.py

  electron-builder copies sidecar-dist/** into resources/voice/ in the installer.
#>
param(
  [string]$PyVersion = "3.11.9",
  [string]$Dest = "sidecar-dist/python"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$zipUrl = "https://www.python.org/ftp/python/$PyVersion/python-$PyVersion-embed-amd64.zip"
$tmpZip = Join-Path $env:TEMP "python-embed-$PyVersion.zip"

if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
New-Item -ItemType Directory -Path $Dest -Force | Out-Null

Write-Host "==> Downloading embeddable Python $PyVersion"
Invoke-WebRequest -Uri $zipUrl -OutFile $tmpZip
Expand-Archive -Path $tmpZip -DestinationPath $Dest -Force

# The embeddable distro ships site-packages disabled. Uncomment `import site`
# in the ._pth file so pip-installed packages are importable at runtime.
$pth = Get-ChildItem $Dest -Filter "python*._pth" | Select-Object -First 1
(Get-Content $pth.FullName) -replace '^#\s*import site', 'import site' | Set-Content $pth.FullName

Write-Host "==> Bootstrapping pip"
$getPip = Join-Path $env:TEMP "get-pip.py"
Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPip
& "$Dest/python.exe" $getPip --no-warn-script-location

Write-Host "==> Installing sidecar requirements (real wheels, native libs intact)"
& "$Dest/python.exe" -m pip install --no-warn-script-location -r scripts/requirements.txt

# Ship the sidecar script alongside the interpreter.
Copy-Item scripts/voice_sidecar.py (Join-Path (Split-Path $Dest -Parent) "voice_sidecar.py") -Force

$sizeMb = [math]::Round((Get-ChildItem $Dest -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 0)
Write-Host "==> Embedded Python ready at $Dest ($sizeMb MB)"
