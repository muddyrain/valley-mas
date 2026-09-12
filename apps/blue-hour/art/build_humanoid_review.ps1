param([string]$GodotPath = $env:GODOT_BIN)
$ErrorActionPreference = 'Stop'
$appRoot = Split-Path $PSScriptRoot -Parent
if (-not $GodotPath) {
    $engine = Get-Command godot, godot4 -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($engine) { $GodotPath = $engine.Source }
}
if (-not $GodotPath) {
    $pattern = Join-Path $env:USERPROFILE 'Downloads/Godot*_win64*/*_console.exe'
    $engine = Get-ChildItem -Path $pattern -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($engine) { $GodotPath = $engine.FullName }
}
if (-not $GodotPath) { throw 'Set GODOT_BIN or pass -GodotPath.' }

# An isolated project gives this review its own executable without changing the game entry scene.
$reviewRoot = Join-Path $appRoot 'test-output/humanoid-review-project'
$outputRoot = Join-Path $appRoot 'build'
if (Test-Path -LiteralPath $reviewRoot) {
    $resolvedReview = (Resolve-Path -LiteralPath $reviewRoot).Path
    $expectedReview = [IO.Path]::GetFullPath((Join-Path $appRoot 'test-output/humanoid-review-project'))
    if ($resolvedReview -ne $expectedReview) { throw 'Unexpected review workspace path.' }
    Remove-Item -LiteralPath $resolvedReview -Recurse -Force
}
New-Item -ItemType Directory -Path $reviewRoot, $outputRoot -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $appRoot 'test-output/.gdignore'), '')
foreach ($relative in @(
    'debug/humanoid_rig_review.gd',
    'debug/humanoid_catalog.gd',
    'survivors/survivor_animation_controller.gd',
    'scenes/debug/humanoid_rig_review.tscn',
    'assets/animations/humanoid/locomotion/bh_humanoid_reference.tscn',
    'assets/animations/humanoid/locomotion/bh_humanoid_animations_v1.tres',
    'assets/animations/humanoid/locomotion/bh_humanoid_locomotion_tree.tres',
    'assets/characters/xia_zhiyao/source/xia_zhiyao.glb',
    'assets/characters/xia_zhiyao/source/xia_zhiyao.glb.import',
    'assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb',
    'assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb.import',
    'assets/characters/su_wanxing/source/su_wanxing.glb',
    'assets/characters/su_wanxing/source/su_wanxing.glb.import',
    'assets/characters/su_wanxing/runtime/su_wanxing.glb',
    'assets/characters/su_wanxing/runtime/su_wanxing.glb.import'
)) {
    $destination = Join-Path $reviewRoot $relative
    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $appRoot $relative) -Destination $destination -Force
}
@'
config_version=5
[application]
config/name="BH Humanoid Rig v1 Review"
run/main_scene="res://scenes/debug/humanoid_rig_review.tscn"
[display]
window/size/viewport_width=1280
window/size/viewport_height=800
[rendering]
renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
'@ | Set-Content -LiteralPath (Join-Path $reviewRoot 'project.godot') -Encoding UTF8
@'
[preset.0]
name="Windows Desktop"
platform="Windows Desktop"
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path=""
[preset.0.options]
binary_format/embed_pck=true
binary_format/architecture="x86_64"
texture_format/s3tc_bptc=true
application/product_name="BH Humanoid Rig v1 Review"
application/file_version="0.2.0.0"
'@ | Set-Content -LiteralPath (Join-Path $reviewRoot 'export_presets.cfg') -Encoding UTF8
$executable = Join-Path $outputRoot 'BH_Humanoid_Rig_v1_Review.exe'
foreach ($arguments in @(
    ,@('--headless', '--editor', '--import', '--quit'),
    ,@('--headless', '--export-release', 'Windows Desktop', $executable)
)) {
    $result = & $GodotPath --path $reviewRoot @arguments 2>&1
    $result | Write-Output
    if ($LASTEXITCODE -ne 0 -or ($result -join "`n") -match '(?m)^(SCRIPT ERROR|ERROR):') {
        throw 'Rig review import/export failed.'
    }
}
$verifyRoot = Join-Path $appRoot 'test-output/rig/review-standalone'
New-Item -ItemType Directory -Path $verifyRoot -Force | Out-Null
$standalone = Join-Path $verifyRoot 'BH_Humanoid_Rig_v1_Review.exe'
Copy-Item -LiteralPath $executable -Destination $standalone -Force
foreach ($mode in @('headless', 'native')) {
    $log = Join-Path $verifyRoot ($mode + '.log')
    $arguments = @('--quit-after', '120', '--audio-driver', 'Dummy', '--log-file', ('"' + $log + '"'))
    if ($mode -eq 'headless') { $arguments += '--headless' } else { $arguments += @('--position', '-3000,-3000') }
    $process = Start-Process -FilePath $standalone -ArgumentList $arguments -WindowStyle Hidden -PassThru
    if (-not $process.WaitForExit(30000)) { $process.Kill(); throw 'Rig review startup timed out.' }
    if ($process.ExitCode -ne 0 -or (Get-Content -LiteralPath $log -Raw) -match '(?m)^(SCRIPT ERROR|ERROR):') {
        throw "Rig review $mode startup failed."
    }
    Write-Output "RIG REVIEW $mode standalone: PASS"
}
Write-Output "Rig review executable: $executable"
