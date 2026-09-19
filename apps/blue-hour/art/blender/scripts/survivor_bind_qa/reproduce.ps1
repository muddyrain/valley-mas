param(
    [string]$Godot = 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe',
    [string]$Blender = 'D:/Blender/blender.exe',
    [string]$Python = 'C:/Users/A/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
)
$ErrorActionPreference = 'Stop'
$appRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$qaRoot = Join-Path $appRoot 'test-output/survivor-t-pose-bind'
& $Python (Join-Path $PSScriptRoot 'prepare.py')
if ($LASTEXITCODE -ne 0) { throw 'Review staging failed' }
function Invoke-Checked([string]$Exe, [string[]]$Arguments, [string]$Log) {
    & $Exe @Arguments *> (Join-Path $qaRoot "logs/$Log.log")
    if ($LASTEXITCODE -ne 0) { throw "$Log failed; inspect logs/$Log.log" }
}
foreach ($character in @('xia_zhiyao','su_wanxing')) {
    Invoke-Checked $Blender @('--background','--factory-startup','--python-exit-code','1','--python',(Join-Path $appRoot 'art/blender/scripts/align_survivor_bind.py'),'--',$character) "$character-bind"
}
Invoke-Checked $Blender @('--background','--factory-startup','--python-exit-code','1','--python',(Join-Path $appRoot 'art/blender/scripts/validate_survivor_t_bind.py')) 'contract'
Invoke-Checked $Godot @('--headless','--path',$qaRoot,'--editor','--import','--quit') 'import'
Invoke-Checked $Godot @('--headless','--path',$qaRoot,'--script','direct_drive_qa.gd','--','dual') 'runtime'
foreach ($script in @('static_qa','details')) {
    Invoke-Checked $Godot @('--path',$qaRoot,'--position','-3000,-3000','--audio-driver','Dummy','--script',"$script.gd",'--','dual') $script
}
foreach ($script in @('static_analysis','analyze_dual','upper_dynamic')) {
    Invoke-Checked $Python @((Join-Path $qaRoot "$script.py")) $script
}
Invoke-Checked $Godot @('--path',$qaRoot,'--position','-3000,-3000','--audio-driver','Dummy','--script','direct_drive_qa.gd','--','capture','dual') 'capture'
Invoke-Checked $Python @((Join-Path $qaRoot 'package_media.py'),'--dual') 'media'
Invoke-Checked $Godot @('--headless','--path',$qaRoot,'--export-release','Windows Desktop','build/SurvivorBindReview.exe') 'export'
Invoke-Checked (Join-Path $qaRoot 'build/SurvivorBindReview.exe') @('--position','-3000,-3000','--audio-driver','Dummy','--quit-after','180') 'export-smoke'
Invoke-Checked $Python @((Join-Path $qaRoot 'publish.py')) 'publish'
Write-Output "Review: $qaRoot/index.html. Numeric checks do not replace visual acceptance."
