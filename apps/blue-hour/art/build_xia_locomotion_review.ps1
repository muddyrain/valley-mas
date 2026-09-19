param(
    [string]$GodotPath = 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe',
    [switch]$Capture
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$reviewOutput = Join-Path $projectRoot 'test-output/xia-zhiyao-locomotion'
$reviewProject = Join-Path $reviewOutput 'project'
$reviewBuild = Join-Path $reviewOutput 'build'
New-Item -ItemType Directory -Force -Path $reviewProject, $reviewBuild | Out-Null
$files = @(
    'assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb',
    'assets/characters/xia_zhiyao/runtime/xia_zhiyao.glb.import',
    'assets/characters/xia_zhiyao/animations/idle.tres',
    'assets/characters/xia_zhiyao/animations/walking.tres',
    'assets/characters/xia_zhiyao/animations/running.tres',
    'debug/xia_zhiyao_locomotion_review.gd',
    'scenes/debug/xia_zhiyao_locomotion_review.tscn'
)
foreach ($relative in $files) {
    $destination = Join-Path $reviewProject $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
    Copy-Item -LiteralPath (Join-Path $projectRoot $relative) -Destination $destination -Force
}
@'
config_version=5
[application]
config/name="Xia Zhiyao Locomotion Review"
run/main_scene="res://scenes/debug/xia_zhiyao_locomotion_review.tscn"
[display]
window/size/viewport_width=1280
window/size/viewport_height=960
[rendering]
renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
'@ | Set-Content -LiteralPath (Join-Path $reviewProject 'project.godot') -Encoding utf8NoBOM
@'
[preset.0]
name="Windows Desktop"
platform="Windows Desktop"
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="../build/XiaZhiyaoLocomotionReview.exe"
script_export_mode=2
[preset.0.options]
binary_format/embed_pck=true
binary_format/architecture="x86_64"
texture_format/s3tc_bptc=true
texture_format/etc2_astc=false
application/modify_resources=false
debug/export_console_wrapper=0
'@ | Set-Content -LiteralPath (Join-Path $reviewProject 'export_presets.cfg') -Encoding utf8NoBOM
& $GodotPath --headless --path $reviewProject --editor --import *> (Join-Path $reviewOutput 'isolated-import.log')
if ($LASTEXITCODE -ne 0) { throw 'Review import failed' }
& $GodotPath --headless --path $reviewProject --export-release 'Windows Desktop' *> (Join-Path $reviewOutput 'build.log')
if ($LASTEXITCODE -ne 0) { throw 'Review export failed' }
$reviewExe = Join-Path $reviewBuild 'XiaZhiyaoLocomotionReview.exe'
foreach ($clip in @('idle', 'walking', 'running')) {
    $nativeLog = Join-Path $reviewOutput "native-$clip.log"
    $process = Start-Process -FilePath $reviewExe -ArgumentList @('--quit-after', '180', '--', $clip) -WindowStyle Hidden -PassThru -RedirectStandardOutput $nativeLog -RedirectStandardError (Join-Path $reviewOutput "native-$clip-errors.log")
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "$clip independent startup failed" }
}
if ($Capture) {
    foreach ($clip in @('idle', 'walking', 'running')) {
        & $GodotPath --path $reviewProject --resolution 1280x960 -- capture $clip "output=$($reviewOutput.Replace('\','/'))" *> (Join-Path $reviewOutput "capture-$clip.log")
        if ($LASTEXITCODE -ne 0) { throw "$clip capture failed" }
    }
}
Write-Output "Independent review: $reviewExe"
