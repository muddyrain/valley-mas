param(
    [string]$Godot = 'C:/Users/A/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe',
    [string]$Blender = 'D:/Blender/blender.exe',
    [string]$Python = 'C:/Users/A/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
)
$ErrorActionPreference = 'Stop'
$appRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$qaRoot = Join-Path $appRoot 'test-output/survivor-upper-skin'
& $Python (Join-Path $PSScriptRoot 'prepare.py')
if ($LASTEXITCODE -ne 0) { throw 'Staging failed' }
function Invoke-Checked([string]$Exe, [string[]]$Arguments, [string]$Log) {
    $logPath = Join-Path $qaRoot "logs/$Log.log"
    & $Exe @Arguments *> $logPath
    if ($LASTEXITCODE -ne 0) { throw "$Log failed" }
    if (Select-String -LiteralPath $logPath -Pattern 'SCRIPT ERROR:|Parse Error:|^ERROR:' -Quiet) { throw "$Log reported an engine error" }
}
foreach ($cid in @('xia_zhiyao','su_wanxing')) {
    Invoke-Checked $Blender @('--background','--factory-startup','--python-exit-code','1','--python',(Join-Path $appRoot 'art/blender/scripts/polish_survivor_skin.py'),'--',$cid) "$cid-bind"
}
Invoke-Checked $Blender @('--background','--factory-startup','--python-exit-code','1','--python',(Join-Path $PSScriptRoot 'validate.py')) 'validation'
Invoke-Checked $Godot @('--headless','--path',$qaRoot,'--editor','--import','--quit') 'import'
Invoke-Checked $Godot @('--headless','--path',$qaRoot,'--script','direct_drive_qa.gd','--','dual') 'runtime'
Invoke-Checked $Python @((Join-Path $qaRoot 'analyze.py')) 'analysis'
Invoke-Checked $Godot @('--path',$qaRoot,'--position','-3000,-3000','--audio-driver','Dummy','--script','capture_upper.gd') 'capture'
Invoke-Checked $Python @((Join-Path $qaRoot 'package.py')) 'media'
Invoke-Checked $Godot @('--headless','--path',$qaRoot,'--export-release','Windows Desktop','build/SurvivorSkinReview.exe') 'export'
Invoke-Checked (Join-Path $qaRoot 'build/SurvivorSkinReview.exe') @('--position','-3000,-3000','--audio-driver','Dummy','--quit-after','180') 'export-smoke'
Write-Output "Review artifacts: $qaRoot/index.html"
