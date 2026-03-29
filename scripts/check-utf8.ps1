$ErrorActionPreference = "Stop"

$textExt = @(
  ".ts",".tsx",".js",".jsx",".json",".jsonc",".css",".scss",".md",".go",
  ".toml",".yml",".yaml",".env",".txt",".html",".sql",".sh",".ps1",".cjs",".mjs"
)

$files = git ls-files | Where-Object {
  $ext = [System.IO.Path]::GetExtension($_).ToLowerInvariant()
  $textExt -contains $ext -or $_ -match '(^|/)\.env(\.|$)'
}

$bad = @()
foreach ($f in $files) {
  if (-not (Test-Path $f)) { continue }
  $bytes = [System.IO.File]::ReadAllBytes($f)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $bad += "$f (has BOM)"
    continue
  }

  # Validate UTF-8 (throw on invalid byte sequences)
  try {
    $utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
    [void]$utf8Strict.GetString($bytes)
  } catch {
    $bad += "$f (invalid UTF-8)"
  }
}

if ($bad.Count -gt 0) {
  Write-Host "Found non UTF-8 (or UTF-8 BOM) files:" -ForegroundColor Red
  $bad | ForEach-Object { Write-Host " - $_" -ForegroundColor Yellow }
  exit 1
}

Write-Host "All checked text files are UTF-8 (without BOM)." -ForegroundColor Green
