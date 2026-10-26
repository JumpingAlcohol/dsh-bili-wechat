param([Parameter(Mandatory=$true)][string]$WeChatAgentPath,[switch]$Apply,[string]$RestoreBackup)
$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path -LiteralPath $WeChatAgentPath).Path
$taskDistribution=Join-Path $taskRoot 'data\workspace\config\distribution.json'
if(-not (Test-Path -LiteralPath $taskDistribution)){throw 'Select the WeChatAgent installation root containing app and data.'}
if($Apply -or $RestoreBackup){
 $taskRunning=@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq (Join-Path $taskRoot 'app\WeChatAgent.exe') -or $_.Name -eq 'DeepSeek Harness.exe' })
 if($taskRunning.Count){throw 'Exit WeChatAgent and DSH from their trays before applying/restoring. Keep WeChat logged in.'}
}
$taskConfig=Get-Content -LiteralPath $taskDistribution -Raw -Encoding UTF8 | ConvertFrom-Json
$taskNode=if($taskConfig.node -and (Test-Path -LiteralPath $taskConfig.node)){$taskConfig.node}else{Get-ChildItem -LiteralPath (Join-Path $taskRoot 'data\runtimes') -Directory | ForEach-Object {Join-Path $_.FullName 'node.exe'} | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1}
if(-not $taskNode){throw 'Bundled Node.js runtime not found.'}
$taskArguments=@((Join-Path $PSScriptRoot 'scripts\installer.mjs'),'--wechat-agent',$taskRoot)
if($RestoreBackup){$taskArguments+=@('--restore',$RestoreBackup)}elseif($Apply){$taskArguments+='--apply'}
& $taskNode @taskArguments
exit $LASTEXITCODE
