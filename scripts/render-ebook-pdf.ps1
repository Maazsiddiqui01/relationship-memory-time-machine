$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $root "output\pdf"
$manifestPath = Join-Path $outputDir "ebook-manifest.json"

if (-not (Test-Path $manifestPath)) {
  throw "Missing ebook manifest: $manifestPath"
}

$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
$htmlPath = [string]$manifest.html_path
$pdfPath = [string]$manifest.pdf_path

if (-not (Test-Path $htmlPath)) {
  throw "Missing HTML artifact: $htmlPath"
}

$browserPath = if (Test-Path "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe") {
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
} elseif (Test-Path "C:\Program Files\Microsoft\Edge\Application\msedge.exe") {
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
} else {
  throw "Microsoft Edge was not found in the default installation paths."
}

$uri = [System.Uri]::new($htmlPath).AbsoluteUri

& $browserPath `
  --headless=new `
  --disable-gpu `
  --hide-scrollbars `
  --print-to-pdf="$pdfPath" `
  --print-to-pdf-no-header `
  $uri

for ($i = 0; $i -lt 40; $i++) {
  if (Test-Path $pdfPath) {
    break
  }

  Start-Sleep -Milliseconds 250
}

if (-not (Test-Path $pdfPath)) {
  throw "PDF export failed: $pdfPath was not created."
}

Write-Host ("Wrote " + (Resolve-Path $pdfPath | ForEach-Object { $_.Path.Substring($root.Length + 1) }))
