# 从 website 仓库的 site_moeapk 重新提取数据快照到 js/data/*.js
# 用法：powershell -File tools/extract-data.ps1
# 出处：website/mukaapp_moeapk/site_moeapk（服务端 catalog.rs 编译期内嵌的同一份数据）
$ErrorActionPreference = 'Stop'
$src = 'C:\Users\Attect\RustroverProjects\website\mukaapp_moeapk\site_moeapk'
$dst = 'D:\moeapk-app\prototype\js\data'

# 应用目录：apps/*.json（_ 开头除外）全量内嵌
$apps = Get-ChildItem "$src\apps\*.json" | Where-Object { $_.Name -notlike '_*' } |
  ForEach-Object { Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json }
$appsJson = $apps | ConvertTo-Json -Depth 20

# 开源收录：open/*.json（_ 开头除外）
$opens = Get-ChildItem "$src\open\*.json" | Where-Object { $Name = $_.Name; $Name -notlike '_*' } |
  ForEach-Object { Get-Content $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json }
$opensJson = $opens | ConvertTo-Json -Depth 20

# AI 目录：取代表子集（全量 195 条太大；按需增删此列表）
$aiIds = @('llm-fork', 'bonsai-1-7b-q1', 'audio8-tts', 'audio8-tts-encoder',
  'chillout-mix-qnn', 'animagine-v4-sdxl', 'upscale-anime-onnx', 'upscale-real-qnn', 'sharp-mnn')
$ais = $aiIds | ForEach-Object { Get-Content "$src\ai\$_.json" -Raw -Encoding UTF8 | ConvertFrom-Json }
$aisJson = $ais | ConvertTo-Json -Depth 20

@"
// 本文件由 tools/extract-data.ps1 生成于 $(Get-Date -Format 'yyyy-MM-dd HH:mm')，请勿手改。
window.DB = window.DB || {};
window.DB.DEMO_ITEMS = true;
window.DB.CATALOG = $appsJson;
window.DB.UPDATES = [];
"@ | Out-File "$dst\catalog.js" -Encoding UTF8

@"
// 本文件由 tools/extract-data.ps1 生成于 $(Get-Date -Format 'yyyy-MM-dd HH:mm')，请勿手改。
window.DB = window.DB || {};
window.DB.OPEN = $opensJson;
"@ | Out-File "$dst\open.js" -Encoding UTF8

@"
// 本文件由 tools/extract-data.ps1 生成于 $(Get-Date -Format 'yyyy-MM-dd HH:mm')，请勿手改。
window.DB = window.DB || {};
window.DB.AI = $aisJson;
window.DB.MODEL_SEARCH_DEMO = [];
"@ | Out-File "$dst\ai.js" -Encoding UTF8

Write-Host "已提取 catalog=$($apps.Count) open=$($opens.Count) ai=$($ais.Count) -> $dst"
Write-Host '注意：脚本生成的是纯净真实数据；演示项（demo-*）、演示更新与搜索演示数据需保留手改，请从 git 恢复相关段落或手工合并。'
