param([string]$ExecutablePath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'build/BlueHourHomeward.exe'))
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'assets/generated/manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$expectedAssets = @($manifest.assets.PSObject.Properties).Count
$artifactRoot = Join-Path $projectRoot 'test-output/art/standalone'
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
