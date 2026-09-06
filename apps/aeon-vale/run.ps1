param(
    [ValidateSet('run', 'editor', 'test', 'capture', 'export')]
    [string]$Mode = 'run',
    [string]$GodotPath = $env:GODOT_BIN
)

$ErrorActionPreference = 'Stop'
if (-not $GodotPath) {
    $installedGodot = Get-Command godot, godot4 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($installedGodot) { $GodotPath = $installedGodot.Source }
}
if (-not $GodotPath) {
    $downloadPattern = Join-Path $env:USERPROFILE 'Downloads/Godot*_win64*/*_console.exe'
    $portableGodot = Get-ChildItem -Path $downloadPattern -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($portableGodot) { $GodotPath = $portableGodot.FullName }
}
if (-not $GodotPath -or -not (Test-Path -LiteralPath $GodotPath -PathType Leaf)) {
    throw 'Godot was not found. Set GODOT_BIN or pass -GodotPath with a Godot 4.7 console executable.'
}

$gameArguments = @('--path', $PSScriptRoot)
switch ($Mode) {
    'editor' { $gameArguments += '--editor' }
    'test' {
        $gameArguments += @('--headless', '--script', 'tests/run.gd')
    }
    'capture' {
        # Keep synthetic viewport input separate from the player's desktop pointer.
        $gameArguments += @('--position', '-3000,-3000', '--script', 'tests/runtime.gd')
    }
    'export' {
        New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot 'build') -Force | Out-Null
        $gameArguments += @('--headless', '--export-release', 'Windows Desktop')
    }
}
& $GodotPath @gameArguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($Mode -eq 'test') {
    & $GodotPath --headless --path $PSScriptRoot --script tests/ecology.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --headless --path $PSScriptRoot --script tests/polish.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --headless --path $PSScriptRoot --script tests/seasons.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --headless --path $PSScriptRoot --script tests/canopy.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --headless --path $PSScriptRoot --script tests/landscape.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --headless --path $PSScriptRoot --script tests/feedback.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --headless --path $PSScriptRoot --script tests/weather.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --headless --path $PSScriptRoot --script tests/calendar.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --headless --path $PSScriptRoot --script tests/renewal.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --headless --path $PSScriptRoot --script tests/tempests.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --headless --path $PSScriptRoot --script tests/earth_and_soil.gd
}
if ($Mode -eq 'capture') {
    & $GodotPath --position -3000,-3000 --path $PSScriptRoot --script tests/interface.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --position -3000,-3000 --path $PSScriptRoot --script tests/seasons_runtime.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --position -3000,-3000 --path $PSScriptRoot --script tests/canopy_runtime.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --position -3000,-3000 --path $PSScriptRoot --script tests/landscape_runtime.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --position -3000,-3000 --path $PSScriptRoot --script tests/feedback_runtime.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --position -3000,-3000 --path $PSScriptRoot --script tests/weather_runtime.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --position -3000,-3000 --path $PSScriptRoot --script tests/landform_runtime.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --position -3000,-3000 --path $PSScriptRoot --script tests/interface_design.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --position -3000,-3000 --path $PSScriptRoot --script tests/renewal_runtime.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --position -3000,-3000 --path $PSScriptRoot --script tests/tempests_runtime.gd
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $GodotPath --position -3000,-3000 --path $PSScriptRoot --script tests/earth_runtime.gd
}
exit $LASTEXITCODE
