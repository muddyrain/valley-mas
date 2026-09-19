param(
    [string]$Godot = 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe',
    [string]$Blender = 'D:/Blender/blender.exe',
    [string]$Python = 'C:/Users/A/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
)
$ErrorActionPreference = 'Stop'
$appRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$qaRoot = Join-Path $appRoot 'test-output/canonical-public-locomotion'
New-Item -ItemType Directory -Force -Path $qaRoot | Out-Null
Get-ChildItem -LiteralPath $PSScriptRoot -File | Where-Object { $_.Extension -ne '.ps1' -and $_.Name -ne '.gdignore' } | Copy-Item -Destination $qaRoot -Force
foreach ($folder in @('logs','evidence','build','sources')) {
    $target = Join-Path $qaRoot $folder
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Set-Content -LiteralPath (Join-Path $target '.gdignore') -Value '' -Encoding utf8
}
function Invoke-Checked([string]$Exe, [string[]]$Arguments, [string]$Log) {
    & $Exe @Arguments *> (Join-Path $qaRoot "logs/$Log.log")
    if ($LASTEXITCODE -ne 0) { throw "$Log failed; inspect logs/$Log.log" }
}
Invoke-Checked $Python @((Join-Path $qaRoot 'prepare.py')) 'prepare'
Invoke-Checked $Blender @('--background','--factory-startup','--python-exit-code','1','--python',(Join-Path $qaRoot 'build_canonical_proxy.py')) 'proxy'
Invoke-Checked $Godot @('--headless','--path',$appRoot,'--script',(Join-Path $qaRoot 'sample_source.gd')) 'sample-source'
Invoke-Checked $Godot @('--headless','--path',$qaRoot,'--editor','--import','--quit') 'import'
Invoke-Checked $Godot @('--headless','--path',$qaRoot,'--script','describe_canonical.gd') 'rig-contract'
Invoke-Checked $Blender @('--background','--factory-startup','--python-exit-code','1','--python',(Join-Path $qaRoot 'convert.py')) 'convert'
# Nominal speed is fitted after the first canonical playback, not a gameplay value.
Invoke-Checked $Godot @('--headless','--path',$qaRoot,'--script','bake.gd') 'bake'
Invoke-Checked $Godot @('--headless','--path',$qaRoot,'--script','direct_drive_qa.gd') 'canonical-runtime'
Invoke-Checked $Python @((Join-Path $qaRoot 'analyze_conversion.py')) 'canonical-analysis'
Invoke-Checked $Godot @('--headless','--path',$qaRoot,'--script','bake.gd') 'bake-fitted-speed'
Invoke-Checked $Python @((Join-Path $qaRoot 'verify_conversion.py')) 'verify'
Invoke-Checked $Python @((Join-Path $qaRoot 'gate.py')) 'canonical-gate'
Invoke-Checked $Godot @('--path',$qaRoot,'--position','-3000,-3000','--audio-driver','Dummy','--script','direct_drive_qa.gd','--','capture') 'canonical-capture'
Invoke-Checked $Python @((Join-Path $qaRoot 'package_media.py')) 'canonical-media'
Invoke-Checked $Godot @('--headless','--path',$qaRoot,'--script','direct_drive_qa.gd','--','dual') 'dual-runtime'
Invoke-Checked $Python @((Join-Path $qaRoot 'analyze_dual.py')) 'dual-analysis'
Invoke-Checked $Godot @('--path',$qaRoot,'--position','-3000,-3000','--audio-driver','Dummy','--script','direct_drive_qa.gd','--','capture','dual') 'dual-capture'
Invoke-Checked $Godot @('--path',$qaRoot,'--position','-3000,-3000','--audio-driver','Dummy','--script','details.gd','--','dual') 'details'
Invoke-Checked $Python @((Join-Path $qaRoot 'package_media.py'),'--dual') 'dual-media'
Invoke-Checked $Godot @('--headless','--path',$qaRoot,'--export-release','Windows Desktop','build/CanonicalLocomotionReview.exe') 'export'
Invoke-Checked (Join-Path $qaRoot 'build/CanonicalLocomotionReview.exe') @('--position','-3000,-3000','--audio-driver','Dummy','--quit-after','180') 'export-smoke'
Invoke-Checked $Python @((Join-Path $qaRoot 'publish.py')) 'publish'
Invoke-Checked $Python @((Join-Path $qaRoot 'finalize.py')) 'finalize'
Write-Output "Artifacts: $qaRoot/index.html. Candidate skin verdict remains FAIL; no gameplay integration."
