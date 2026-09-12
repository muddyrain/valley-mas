param(
    [ValidateSet('run', 'editor', 'art', 'import', 'test', 'smoke', 'capture', 'build')]
    [string]$Mode = 'run',
    [string]$GodotPath = $env:GODOT_BIN
)
$ErrorActionPreference = 'Stop'
if (-not $GodotPath) {
    $engineCommand = Get-Command godot, godot4 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($engineCommand) { $GodotPath = $engineCommand.Source }
}
if (-not $GodotPath) {
    $portablePattern = Join-Path $env:USERPROFILE 'Downloads/Godot*_win64*/*_console.exe'
    $engineFile = Get-ChildItem -Path $portablePattern -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($engineFile) { $GodotPath = $engineFile.FullName }
}
if (-not $GodotPath -or -not (Test-Path -LiteralPath $GodotPath -PathType Leaf)) {
    throw 'Godot 4.x was not found. Set GODOT_BIN or pass -GodotPath.'
}
if ($Mode -in @('test', 'capture', 'import', 'smoke', 'build')) {
    $artifactDirectory = Join-Path $PSScriptRoot 'test-output'
    New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $artifactDirectory '.gdignore'), '')
}
function Invoke-Engine([string[]]$EngineArguments) {
    $engineOutput = & $GodotPath --path $PSScriptRoot @EngineArguments 2>&1
    $engineExitCode = $LASTEXITCODE
    $engineOutput | ForEach-Object { Write-Output "$_" }
    if ($engineExitCode -ne 0 -or ($engineOutput -join "`n") -match '(?m)^(SCRIPT ERROR|ERROR):') {
        throw "Godot validation failed (exit $engineExitCode). See output above."
    }
}
function Test-StandaloneBuild([string]$ExecutablePath) {
    # A copy in a separate directory proves that the executable uses its embedded pack.
    $standaloneDirectory = Join-Path $PSScriptRoot 'test-output/standalone'
    New-Item -ItemType Directory -Path $standaloneDirectory -Force | Out-Null
    $standaloneExecutable = Join-Path $standaloneDirectory 'BlueHourHomeward.exe'
    Copy-Item -LiteralPath $ExecutablePath -Destination $standaloneExecutable -Force
    foreach ($verificationMode in @('headless', 'native', 'menu-headless', 'menu-native')) {
        $logPath = Join-Path $standaloneDirectory ($verificationMode + '.log')
        $stdoutPath = Join-Path $standaloneDirectory ($verificationMode + '.stdout.log')
        $stderrPath = Join-Path $standaloneDirectory ($verificationMode + '.stderr.log')
        [System.IO.File]::WriteAllText($logPath, '')
        $launchArguments = @('--quit-after', '120', '--log-file', ('"' + $logPath + '"'))
        if ($verificationMode.EndsWith('headless')) {
            $launchArguments += '--headless'
        } else {
            $launchArguments += @('--position', '-3000,-3000', '--audio-driver', 'Dummy')
        }
        $launchArguments += @('--', '--test-save=standalone-04.json')
        if ($verificationMode.StartsWith('menu-')) { $launchArguments += '--test-menu' }
        $process = Start-Process -FilePath $standaloneExecutable -ArgumentList $launchArguments `
            -WorkingDirectory $standaloneDirectory -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
        try {
            if (-not $process.WaitForExit(30000)) {
                Stop-Process -Id $process.Id -Force
                throw "Standalone $verificationMode startup timed out."
            }
            $process.Refresh()
            $startupLog = (@(Get-Content -LiteralPath $logPath, $stdoutPath, $stderrPath -Encoding UTF8) -join "`n")
            if ($process.ExitCode -ne 0 -or $startupLog -match '(?m)^(SCRIPT ERROR|ERROR):' -or $startupLog -notmatch 'Godot Engine') {
                throw "Standalone $verificationMode startup failed. Inspect $logPath."
            }
            Write-Output "Standalone $verificationMode startup: PASS"
        } finally {
            $process.Dispose()
        }
    }
}
switch ($Mode) {
    'run' { & $GodotPath --path $PSScriptRoot }
    'editor' { & $GodotPath --path $PSScriptRoot --editor }
    'art' { & $GodotPath --path $PSScriptRoot -- --art-showcase }
    'import' { Invoke-Engine @('--headless', '--editor', '--import', '--quit') }
    'smoke' { Invoke-Engine @('--headless', '--quit-after', '120', '--', '--test-save=smoke-03.json') }
    'test' {
        Invoke-Engine @('--headless', '--editor', '--import', '--quit')
        Invoke-Engine @('--headless', '--script', 'tests/art_assets.gd')
        Invoke-Engine @('--headless', '--script', 'tests/art_integration.gd')
        Invoke-Engine @('--headless', '--script', 'tests/rules.gd')
        Invoke-Engine @('--headless', '--script', 'tests/mission_flow.gd')
        Invoke-Engine @('--headless', '--script', 'tests/search_dispatch.gd')
        Invoke-Engine @('--headless', '--script', 'tests/parallel_commands.gd')
        Invoke-Engine @('--headless', '--script', 'tests/day_loop.gd')
        Invoke-Engine @('--headless', '--script', 'tests/day_loop_flow.gd')
        Invoke-Engine @('--headless', '--script', 'tests/new_run.gd')
        Invoke-Engine @('--headless', '--script', 'tests/new_run_flow.gd')
        Invoke-Engine @('--headless', '--script', 'tests/effect_system.gd')
    }
    'capture' {
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/art_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/day_loop_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/controls_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/new_run_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/menu_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/effect_runtime.gd')
    }
    'build' {
        $buildDirectory = Join-Path $PSScriptRoot 'build'
        New-Item -ItemType Directory -Path $buildDirectory -Force | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $buildDirectory '.gdignore'), '')
        $executablePath = Join-Path $buildDirectory 'BlueHourHomeward.exe'
        Invoke-Engine @('--headless', '--editor', '--import', '--quit')
        Invoke-Engine @('--headless', '--script', 'tests/art_assets.gd')
        Invoke-Engine @('--headless', '--script', 'tests/art_integration.gd')
        Invoke-Engine @('--headless', '--script', 'tests/rules.gd')
        Invoke-Engine @('--headless', '--script', 'tests/mission_flow.gd')
        Invoke-Engine @('--headless', '--script', 'tests/search_dispatch.gd')
        Invoke-Engine @('--headless', '--script', 'tests/parallel_commands.gd')
        Invoke-Engine @('--headless', '--script', 'tests/day_loop.gd')
        Invoke-Engine @('--headless', '--script', 'tests/day_loop_flow.gd')
        Invoke-Engine @('--headless', '--script', 'tests/new_run.gd')
        Invoke-Engine @('--headless', '--script', 'tests/new_run_flow.gd')
        Invoke-Engine @('--headless', '--script', 'tests/effect_system.gd')
        Invoke-Engine @('--headless', '--export-release', 'Windows Desktop', $executablePath)
        if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
            throw 'Export did not produce BlueHourHomeward.exe.'
        }
        Test-StandaloneBuild $executablePath
        & (Join-Path $PSScriptRoot 'art/verify_export.ps1') -ExecutablePath $executablePath
        $buildFile = Get-Item -LiteralPath $executablePath
        $buildInfo = [ordered]@{
            executable = $buildFile.Name
            builtAt = [DateTimeOffset]::Now.ToString('o')
            bytes = $buildFile.Length
            sha256 = (Get-FileHash -LiteralPath $executablePath -Algorithm SHA256).Hash
            platform = 'Windows x86_64'
            embeddedPack = $true
            checks = @('art-assets', 'art-integration', 'rules', 'mission-flow', 'search-dispatch', 'parallel-commands', 'day-loop', 'day-loop-flow', 'new-run', 'new-run-flow', 'effect-system', 'standalone-headless', 'standalone-native', 'standalone-menu-headless', 'standalone-menu-native', 'standalone-art-headless', 'standalone-art-native')
        }
        $buildInfo | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $buildDirectory 'BUILD-INFO.json') -Encoding UTF8
        Write-Output "Playable build: $executablePath"
    }
}
