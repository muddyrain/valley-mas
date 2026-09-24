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
    $standaloneDirectory = Join-Path $PSScriptRoot "test-output/standalone/$PID"
    New-Item -ItemType Directory -Path $standaloneDirectory -Force | Out-Null
    $standaloneExecutable = Join-Path $standaloneDirectory 'BlueHourHomeward.exe'
    Copy-Item -LiteralPath $ExecutablePath -Destination $standaloneExecutable -Force
    foreach ($verificationMode in @('headless', 'native', 'menu-headless', 'menu-native', 'expedition-headless', 'expedition-native', 'today-action-headless', 'today-action-native', 'weapon-headless', 'weapon-native')) {
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
        if ($verificationMode.StartsWith('expedition-')) { $launchArguments += '--test-expedition' }
        if ($verificationMode.StartsWith('today-action-')) { $launchArguments += '--test-today-action' }
        if ($verificationMode.StartsWith('weapon-')) { $launchArguments += '--test-weapons' }
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
    Remove-Item -LiteralPath $standaloneExecutable -Force
}
switch ($Mode) {
    'run' { & $GodotPath --path $PSScriptRoot }
    'editor' { & $GodotPath --path $PSScriptRoot --editor }
    'art' { & $GodotPath --path $PSScriptRoot -- --art-showcase }
    'import' { Invoke-Engine @('--headless', '--editor', '--import', '--quit') }
    'smoke' { Invoke-Engine @('--headless', '--quit-after', '120', '--', '--test-save=smoke-03.json') }
    'test' {
        Invoke-Engine @('--headless', '--editor', '--import', '--quit')
        Invoke-Engine @('--headless', '--script', 'tests/search_gameplay.gd')
        Invoke-Engine @('--headless', '--script', 'tests/survivor_command.gd')
        Invoke-Engine @('--headless', '--script', 'tests/settings.gd')
        Invoke-Engine @('--headless', '--script', 'tests/camp_party.gd')
        Invoke-Engine @('--headless', '--script', 'tests/camp_departure.gd')
        Invoke-Engine @('--headless', '--script', 'tests/today_action.gd')
        Invoke-Engine @('--headless', '--script', 'tests/world_assets.gd')
        Invoke-Engine @('--headless', '--script', 'tests/world_map.gd')
        Invoke-Engine @('--headless', '--script', 'tests/interior_search.gd')
        Invoke-Engine @('--headless', '--script', 'tests/exploration.gd')
        Invoke-Engine @('--headless', '--script', 'tests/expedition_visual.gd')
        Invoke-Engine @('--headless', '--script', 'tests/minimap_survivor_marker_acceptance.gd')
        Invoke-Engine @('--headless', '--script', 'tests/town_phase_1_2_acceptance.gd')
        Invoke-Engine @('--headless', '--script', 'tests/town_phase_3a_street_prop_pack.gd')
        Invoke-Engine @('--headless', '--script', 'tests/town_phase_3c_urban_dressing.gd')
        Invoke-Engine @('--headless', '--script', 'tests/town_phase_3d_density.gd')
        Invoke-Engine @('--headless', '--script', 'tests/art_assets.gd')
        Invoke-Engine @('--headless', '--script', 'tests/art_integration.gd')
        Invoke-Engine @('--headless', '--script', 'tests/rules.gd')
        Invoke-Engine @('--headless', '--script', 'tests/weapon_system.gd')
        Invoke-Engine @('--headless', '--script', 'tests/weapon_rarity_profile.gd')
        Invoke-Engine @('--headless', '--script', 'tests/weapon_upgrade_candidates.gd')
        Invoke-Engine @('--headless', '--script', 'tests/weapon_combat_phase1a.gd')
        Invoke-Engine @('--headless', '--script', 'tests/combat_vfx_phase1b.gd')
        Invoke-Engine @('--headless', '--script', 'tests/weapon_visuals.gd')
        Invoke-Engine @('--headless', '--script', 'tests/combat_animations.gd')
        Invoke-Engine @('--headless', '--script', 'tests/combat_animation_mission.gd')
        Invoke-Engine @('--headless', '--script', 'tests/survivor_expedition_animation_runtime.gd')
        Invoke-Engine @('--headless', '--script', 'tests/mission_locomotion_style.gd')
        Invoke-Engine @('--headless', '--script', 'tests/camp_locomotion_style.gd')
        Invoke-Engine @('--headless', '--script', 'tests/humanoid_animations.gd')
        Invoke-Engine @('--headless', '--script', 'tests/public_locomotion_production.gd')
        Invoke-Engine @('--headless', '--script', 'tests/trait_foundation.gd')
        Invoke-Engine @('--headless', '--script', 'tests/survivor_definition_data.gd')
        Invoke-Engine @('--headless', '--script', 'tests/survivor_progression.gd')
        Invoke-Engine @('--headless', '--script', 'tests/survivor_profile_data.gd')
        Invoke-Engine @('--headless', '--script', 'tests/survivor_recruitment_roster.gd')
        Invoke-Engine @('--headless', '--script', 'tests/camp_roster_recruitment_integration.gd')
        Invoke-Engine @('--headless', '--script', 'tests/survivor_xp_gameplay.gd')
        Invoke-Engine @('--headless', '--script', 'tests/trait_gameplay.gd')
        Invoke-Engine @('--headless', '--script', 'tests/trait_town.gd')
        Invoke-Engine @('--headless', '--script', 'tests/trait_phase_a.gd')
        Invoke-Engine @('--headless', '--script', 'tests/team_aura_runtime.gd')
        Invoke-Engine @('--headless', '--script', 'tests/periodic_effect_runtime.gd')
        Invoke-Engine @('--headless', '--script', 'tests/minimap_survivor_marker_acceptance.gd')
        Invoke-Engine @('--headless', '--script', 'tests/town_phase_1_2_acceptance.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1280x720', '--audio-driver', 'Dummy', '--script', 'tests/town_phase_3a_capture.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/town_phase_3c_map_capture.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/town_phase_3c_runtime_capture.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/town_phase_3d_capture.gd')
        Invoke-Engine @('--headless', '--script', 'tests/sur_004_emergency_care.gd')
        Invoke-Engine @('--headless', '--script', 'tests/sur_008_morale_boost.gd')
        Invoke-Engine @('--headless', '--script', 'tests/walkable_ground.gd')
        Invoke-Engine @('--headless', '--script', 'tests/infected_basic.gd')
        Invoke-Engine @('--headless', '--script', 'tests/encounter_population.gd')
        Invoke-Engine @('--headless', '--script', 'tests/encounter_ai.gd')
        Invoke-Engine @('--headless', '--script', 'tests/encounter_noise.gd')
        Invoke-Engine @('--headless', '--script', 'tests/encounter_combat.gd')
        Invoke-Engine @('--headless', '--script', 'tests/encounter_clock.gd')
        Invoke-Engine @('--headless', '--script', 'tests/encounter_director.gd')
        Invoke-Engine @('--headless', '--script', 'tests/mission_flow.gd')
        Invoke-Engine @('--headless', '--script', 'tests/search_dispatch.gd')
        Invoke-Engine @('--headless', '--script', 'tests/search_command_ownership.gd')
        Invoke-Engine @('--headless', '--script', 'tests/search_interaction_polish_acceptance.gd')
        Invoke-Engine @('--headless', '--script', 'tests/parallel_commands.gd')
        Invoke-Engine @('--headless', '--script', 'tests/day_loop.gd')
        Invoke-Engine @('--headless', '--script', 'tests/day_loop_flow.gd')
        Invoke-Engine @('--headless', '--script', 'tests/new_run.gd')
        Invoke-Engine @('--headless', '--script', 'tests/new_run_flow.gd')
        Invoke-Engine @('--headless', '--script', 'tests/effect_system.gd')
        Invoke-Engine @('--headless', '--script', 'tests/loot_table.gd')
    }
    'capture' {
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/search_gameplay.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/survivor_command.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/search_active_card.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/search_interaction_polish_acceptance.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/expedition_hud_phase2.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/minimap_phase_1_2_capture.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/encounter_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/expedition_hud_reference.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/camp_locomotion_style.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/mission_locomotion_style.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/combat_animations.gd', '--', 'capture')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/combat_animation_mission.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/weapon_visuals.gd', '--', 'capture')
        Invoke-Engine @('--headless', '--script', 'tests/camp_party.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/camp_interaction.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/camp_menu_overlay_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/camp_ui_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/camp_hud_2.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/camp_clarity_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/camp_departure_layout.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1280x720', '--audio-driver', 'Dummy', '--script', 'tests/camp_departure.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1366x768', '--audio-driver', 'Dummy', '--script', 'tests/weapon_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/today_action_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/expedition_visual_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/poi_context_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/art_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/day_loop_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/controls_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/pause_menu_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/new_run_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/menu_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--script', 'tests/effect_runtime.gd')
    }
    'build' {
        # One canonical output. Never sidestep an occupied executable with another directory.
        $buildDirectory = Join-Path $PSScriptRoot 'build'
        New-Item -ItemType Directory -Path $buildDirectory -Force | Out-Null
        [System.IO.File]::WriteAllText((Join-Path $buildDirectory '.gdignore'), '')
        $executablePath = Join-Path $buildDirectory 'BlueHourHomeward.exe'
        if (Test-Path -LiteralPath $executablePath) {
            try {
                $buildLockProbe = [IO.File]::Open($executablePath, 'Open', 'ReadWrite', 'None')
                $buildLockProbe.Dispose()
            } catch {
                throw "Canonical build is in use: $executablePath. Close that game before building."
            }
        }
        Invoke-Engine @('--headless', '--editor', '--import', '--quit')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/search_gameplay.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/expedition_hud_phase2.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/survivor_command.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/search_active_card.gd')
        Invoke-Engine @('--headless', '--script', 'tests/settings.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/camp_menu_overlay_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/camp_ui_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/camp_hud_2.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1280x720', '--audio-driver', 'Dummy', '--script', 'tests/camp_departure.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1280x720', '--audio-driver', 'Dummy', '--script', 'tests/camp_runtime.gd')
        Invoke-Engine @('--headless', '--script', 'tests/camp_party.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/camp_interaction.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/camp_clarity_runtime.gd')
        Invoke-Engine @('--headless', '--script', 'tests/today_action.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/camp_departure_layout.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/today_action_runtime.gd')
        Invoke-Engine @('--headless', '--script', 'tests/world_assets.gd')
        Invoke-Engine @('--headless', '--script', 'tests/world_map.gd')
        Invoke-Engine @('--headless', '--script', 'tests/interior_search.gd')
        Invoke-Engine @('--headless', '--script', 'tests/exploration.gd')
        Invoke-Engine @('--headless', '--script', 'tests/expedition_visual.gd')
        Invoke-Engine @('--headless', '--script', 'tests/minimap_survivor_marker_acceptance.gd')
        Invoke-Engine @('--headless', '--script', 'tests/art_assets.gd')
        Invoke-Engine @('--headless', '--script', 'tests/art_integration.gd')
        Invoke-Engine @('--headless', '--script', 'tests/rules.gd')
        Invoke-Engine @('--headless', '--script', 'tests/weapon_system.gd')
        Invoke-Engine @('--headless', '--script', 'tests/weapon_rarity_profile.gd')
        Invoke-Engine @('--headless', '--script', 'tests/weapon_upgrade_candidates.gd')
        Invoke-Engine @('--headless', '--script', 'tests/weapon_visuals.gd')
        Invoke-Engine @('--headless', '--script', 'tests/combat_animations.gd')
        Invoke-Engine @('--headless', '--script', 'tests/combat_animation_mission.gd')
        Invoke-Engine @('--headless', '--script', 'tests/survivor_expedition_animation_runtime.gd')
        Invoke-Engine @('--headless', '--script', 'tests/mission_locomotion_style.gd')
        Invoke-Engine @('--headless', '--script', 'tests/camp_locomotion_style.gd')
        Invoke-Engine @('--headless', '--script', 'tests/locomotion_polish.gd')
        Invoke-Engine @('--headless', '--script', 'tests/locomotion_mission.gd')
        Invoke-Engine @('--headless', '--script', 'tests/survivor_locomotion.gd')
        Invoke-Engine @('--headless', '--script', 'tests/humanoid_animations.gd')
        Invoke-Engine @('--headless', '--script', 'tests/public_locomotion_production.gd')
        Invoke-Engine @('--headless', '--script', 'tests/trait_foundation.gd')
        Invoke-Engine @('--headless', '--script', 'tests/trait_gameplay.gd')
        Invoke-Engine @('--headless', '--script', 'tests/trait_town.gd')
        Invoke-Engine @('--headless', '--script', 'tests/walkable_ground.gd')
        Invoke-Engine @('--headless', '--script', 'tests/infected_basic.gd')
        Invoke-Engine @('--headless', '--script', 'tests/encounter_population.gd')
        Invoke-Engine @('--headless', '--script', 'tests/encounter_ai.gd')
        Invoke-Engine @('--headless', '--script', 'tests/encounter_noise.gd')
        Invoke-Engine @('--headless', '--script', 'tests/encounter_combat.gd')
        Invoke-Engine @('--headless', '--script', 'tests/encounter_clock.gd')
        Invoke-Engine @('--headless', '--script', 'tests/encounter_director.gd')
        Invoke-Engine @('--headless', '--script', 'tests/mission_flow.gd')
        Invoke-Engine @('--headless', '--script', 'tests/search_dispatch.gd')
        Invoke-Engine @('--headless', '--script', 'tests/parallel_commands.gd')
        Invoke-Engine @('--headless', '--script', 'tests/day_loop.gd')
        Invoke-Engine @('--headless', '--script', 'tests/day_loop_flow.gd')
        Invoke-Engine @('--headless', '--script', 'tests/new_run.gd')
        Invoke-Engine @('--headless', '--script', 'tests/new_run_flow.gd')
        Invoke-Engine @('--headless', '--script', 'tests/effect_system.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/expedition_visual_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/poi_context_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1440x900', '--audio-driver', 'Dummy', '--script', 'tests/pause_menu_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1366x768', '--audio-driver', 'Dummy', '--script', 'tests/weapon_runtime.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/weapon_visuals.gd', '--', 'capture')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/combat_animation_mission.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/mission_locomotion_style.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1920x1080', '--audio-driver', 'Dummy', '--script', 'tests/expedition_hud_reference.gd')
        Invoke-Engine @('--position', '-3000,-3000', '--resolution', '1600x900', '--audio-driver', 'Dummy', '--script', 'tests/encounter_runtime.gd')
        Invoke-Engine @('--headless', '--export-release', 'Windows Desktop', $executablePath)
        if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
            throw 'Export did not produce BlueHourHomeward.exe.'
        }
        Test-StandaloneBuild $executablePath
        & (Join-Path $PSScriptRoot 'art/verify_export.ps1') -ExecutablePath $executablePath -GodotPath $GodotPath
        $buildFile = Get-Item -LiteralPath $executablePath
        $buildInfo = [ordered]@{
            executable = $buildFile.Name
            builtAt = [DateTimeOffset]::Now.ToString('o')
            bytes = $buildFile.Length
            sha256 = (Get-FileHash -LiteralPath $executablePath -Algorithm SHA256).Hash
            platform = 'Windows x86_64'
            embeddedPack = $true
            weaponChecks = @('weapon-system', 'weapon-runtime', 'weapon-visuals', 'humanoid-animations', 'standalone-weapon-headless', 'standalone-weapon-native', 'embedded-pack-weapon-visuals-headless', 'embedded-pack-weapon-visuals-native')
            combatAnimationChecks = @('combat-animations', 'combat-animation-mission-headless', 'combat-animation-mission-native', 'locomotion-polish', 'locomotion-mission', 'survivor-locomotion', 'embedded-pack-combat-headless', 'embedded-pack-combat-native')
            missionStyleChecks = @('mission-locomotion-style-headless', 'mission-locomotion-style-native', 'shared-public-locomotion', 'muzzle-flash')
            campStyleChecks = @('camp-locomotion-style', 'camp-walk-context')
            publicLocomotionChecks = @('public-locomotion-production', 'native-canonical-rest', 'shared-resource-identity', 'speed-ratio', 'idle-walk-run-transitions', 'no-runtime-retarget')
            campChecks = @('camp-hud-2-native-centering', 'camp-party', 'camp-ui-runtime', 'camp-interaction', 'camp-departure', 'camp-runtime', 'camp-clarity-runtime')
            todayActionChecks = @('today-action', 'today-action-runtime', 'standalone-today-action-headless', 'standalone-today-action-native')
            checks = @('encounter-population', 'encounter-ai', 'encounter-noise', 'encounter-combat', 'encounter-clock', 'encounter-director', 'encounter-runtime', 'expedition-hud-2_0_1', 'settings', 'world-assets', 'world-map', 'world-map-runtime', 'interior-search', 'exploration', 'expedition-visual', 'expedition-visual-runtime', 'poi-context-runtime', 'pause-menu-runtime', 'art-assets', 'art-integration', 'rules', 'infected-basic', 'mission-flow', 'search-dispatch', 'parallel-commands', 'day-loop', 'day-loop-flow', 'new-run', 'new-run-flow', 'effect-system', 'standalone-headless', 'standalone-native', 'standalone-menu-headless', 'standalone-menu-native', 'standalone-expedition-headless', 'standalone-expedition-native', 'standalone-art-headless', 'standalone-art-native')
        }
        $buildInfo | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $buildDirectory 'BUILD-INFO.json') -Encoding UTF8
        Write-Output "Playable build: $executablePath"
    }
}
