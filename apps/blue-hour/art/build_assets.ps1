param(
    [ValidateSet('all', 'architecture', 'props', 'vehicles', 'weapons', 'infected')]
    [string]$Batch = 'all',
    [string]$BlenderPath = 'D:\Blender\blender.exe',
    [string]$GodotPath = $env:GODOT_BIN
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path -LiteralPath $BlenderPath -PathType Leaf)) { throw "Blender executable not found: $BlenderPath" }
if (-not $GodotPath) {
    $engineCommand = Get-Command godot, godot4 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($engineCommand) { $GodotPath = $engineCommand.Source }
}
if (-not $GodotPath) {
    $engineFile = Get-ChildItem -Path (Join-Path $env:USERPROFILE 'Downloads/Godot*_win64*/*_console.exe') -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($engineFile) { $GodotPath = $engineFile.FullName }
}
if (-not $GodotPath -or -not (Test-Path -LiteralPath $GodotPath -PathType Leaf)) { throw 'Godot not found. Pass -GodotPath.' }
$pythonPath = Join-Path (Split-Path $BlenderPath -Parent) '5.2/python/bin/python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Bundled Blender Python 5.2 not found.' }
$outputDirectory = Join-Path $projectRoot 'test-output/art'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

function Invoke-Checked([string]$Program, [string[]]$Arguments, [string]$LogName) {
    $logPath = Join-Path $outputDirectory $LogName
    & $Program @Arguments *> $logPath
    $commandExit = $LASTEXITCODE
    $captured = Get-Content -LiteralPath $logPath -Raw -Encoding UTF8
    if ($commandExit -ne 0 -or $captured -match '(?m)^(SCRIPT ERROR|ERROR|Traceback|FAIL):?') {
        Write-Output $captured
        throw "Asset pipeline failed: $LogName (exit $commandExit)"
    }
    Get-Content -LiteralPath $logPath -Tail 4 -Encoding UTF8
}

$batches = if ($Batch -eq 'all') { @('architecture', 'props', 'vehicles', 'weapons', 'infected') } else { @($Batch) }
foreach ($currentBatch in $batches) {
    Invoke-Checked $BlenderPath @('--background', '--factory-startup', '--python-exit-code', '1', '--python', (Join-Path $PSScriptRoot 'blender/generate.py'), '--', '--batch', $currentBatch) "$currentBatch-blender.log"
    Invoke-Checked $pythonPath @((Join-Path $PSScriptRoot 'blender/validate_assets.py'), '--batch', $currentBatch) "$currentBatch-validate.log"
    Invoke-Checked $GodotPath @('--headless', '--path', $projectRoot, '--editor', '--import', '--quit') "$currentBatch-import.log"
    Invoke-Checked $GodotPath @('--headless', '--path', $projectRoot, '--script', 'tests/art_assets.gd', '--', "--batch=$currentBatch") "$currentBatch-godot.log"
    Write-Output "ART BATCH COMPLETE: $currentBatch"
}
if ($Batch -eq 'all') {
    Invoke-Checked $pythonPath @((Join-Path $PSScriptRoot 'blender/validate_assets.py')) 'all-validate.log'
}
