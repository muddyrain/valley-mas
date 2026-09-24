param(
    [string]$ExecutablePath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'build/BlueHourHomeward.exe'),
    [string]$GodotPath = $env:GODOT_BIN
)
$ErrorActionPreference = 'Stop'
if (-not $GodotPath -or -not (Test-Path -LiteralPath $GodotPath -PathType Leaf)) {
    throw 'Pass the same GodotPath used to export this build; embedded-pack script checks require the editor executable.'
}
$projectRoot = Split-Path $PSScriptRoot -Parent
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'assets/generated/manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$expectedAssets = @($manifest.assets.PSObject.Properties).Count
$artifactRoot = Join-Path $projectRoot "test-output/art/standalone/$PID"
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
$standalone = Join-Path $artifactRoot 'BlueHourHomeward.exe'
Copy-Item -LiteralPath $ExecutablePath -Destination $standalone -Force
foreach ($mode in @('headless', 'native')) {
    $stdout = Join-Path $artifactRoot "$mode.stdout.log"
    $stderr = Join-Path $artifactRoot "$mode.stderr.log"
    $arguments = @('--quit-after', '90', '--audio-driver', 'Dummy')
    if ($mode -eq 'headless') { $arguments += '--headless' }
    else { $arguments += @('--position', '-3000,-3000') }
    $arguments += @('--', '--art-showcase')
    $process = Start-Process -FilePath $standalone -ArgumentList $arguments -WorkingDirectory $artifactRoot `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    try {
        if (-not $process.WaitForExit(30000)) {
            Stop-Process -Id $process.Id -Force
            throw "Exported art showcase timed out: $mode"
        }
        $process.Refresh()
        $outputText = Get-Content -LiteralPath $stdout, $stderr -Raw -Encoding UTF8
        if ($process.ExitCode -ne 0 -or ($outputText -join "`n") -match '(?m)^(SCRIPT ERROR|ERROR):' -or ($outputText -join "`n") -notmatch "BH_SHOWCASE_READY $expectedAssets\b") {
            throw "Exported art showcase failed: $mode. See $artifactRoot"
        }
        Write-Output "Standalone art showcase $mode : $expectedAssets embedded assets PASS"
    } finally {
        $process.Dispose()
    }
}

# Release templates do not expose --script. The same editor binary mounts the
# isolated EXE's embedded pack; res:// resolves exclusively inside that pack.
# Test evidence goes to an absolute writable directory, never into res://.
foreach ($visualSuite in @('weapon_visuals', 'survivor_animation_batch')) {
    # Combat checks step thousands of bone poses; concurrent builds can exceed 30 s.
    $suiteTimeoutMs = if ($visualSuite -eq 'survivor_animation_batch') { 90000 } else { 30000 }
foreach ($mode in @('headless', 'native')) {
    $stdout = Join-Path $artifactRoot "$visualSuite-$mode.stdout.log"
    $stderr = Join-Path $artifactRoot "$visualSuite-$mode.stderr.log"
    $visualTest = Join-Path $projectRoot "tests/$visualSuite.gd"
    $arguments = @('--audio-driver', 'Dummy', '--path', ('"' + $artifactRoot + '"'),
        '--main-pack', ('"' + $standalone + '"'), '--script', ('"' + $visualTest + '"'))
    if ($mode -eq 'headless') { $arguments += '--headless' }
    else { $arguments += @('--position', '-3000,-3000', '--resolution', '1600x900') }
    $arguments += @('--', ('"--artifact-path=' + (Join-Path $artifactRoot "$visualSuite-results") + '"'))
    $process = Start-Process -FilePath $GodotPath -ArgumentList $arguments -WorkingDirectory $artifactRoot `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    try {
        if (-not $process.WaitForExit($suiteTimeoutMs)) {
            Stop-Process -Id $process.Id -Force
            throw "Exported $visualSuite timed out: $mode"
        }
        $process.Refresh()
        $outputText = Get-Content -LiteralPath $stdout, $stderr -Raw -Encoding UTF8
        if ($process.ExitCode -ne 0 -or ($outputText -join "`n") -match '(?m)^(SCRIPT ERROR|ERROR):' -or ($outputText -join "`n") -notmatch '(WEAPON VISUALS: \d+ checks, 0 failures|SURVIVOR ANIMATION BATCH: \d+ checks; failures=\[\])') {
            throw "Exported $visualSuite failed: $mode. See $artifactRoot"
        }
        Write-Output "Embedded-pack $visualSuite $mode : production roster PASS"
    } finally {
        $process.Dispose()
    }
}
}
Remove-Item -LiteralPath $standalone -Force
