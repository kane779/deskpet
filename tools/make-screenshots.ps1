# 一键重新生成 README 里的界面截图
# 用法：在本文件上右键 → 使用 PowerShell 运行
# 会用到 Microsoft Edge 的「无头模式」渲染界面，不需要打开真正的程序。

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outDir = Join-Path $root 'screenshots'
$demoPath = (Join-Path $root 'tools\screenshot-demo.html') -replace '\\', '/'
$demoUrl = 'file:///' + $demoPath

New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$candidates = @()
if ($env:ProgramFiles) {
  $candidates += (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
}
if (${env:ProgramFiles(x86)}) {
  $candidates += (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe')
}
if ($env:LOCALAPPDATA) {
  $candidates += (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')
}

$edge = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $edge) {
  Write-Host '没找到 Microsoft Edge，无法截图。' -ForegroundColor Red
  exit 1
}

$shots = @(
  @{ name = '01-待办';   hash = '' },
  @{ name = '02-剪贴板'; hash = '#clip' },
  @{ name = '03-设置';   hash = '#settings' }
)

foreach ($shot in $shots) {
  $file = Join-Path $outDir ($shot.name + '.png')
  Start-Process -FilePath $edge -Wait -ArgumentList @(
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--virtual-time-budget=4000',
    '--window-size=720,1096',
    "--screenshot=$file",
    ($demoUrl + $shot.hash)
  ) | Out-Null

  if (Test-Path $file) {
    Write-Host "已生成 $($shot.name).png" -ForegroundColor Green
  } else {
    Write-Host "生成 $($shot.name).png 失败" -ForegroundColor Red
  }
}

# 合成封面图（需要 Python + Pillow）
# 注意：Windows 自带的 python.exe 可能只是应用商店的占位别名，
# 所以要真的执行一次 --version 确认能跑。
$python = $null
foreach ($cmd in @('python', 'python3', 'py')) {
  try {
    $ver = & $cmd --version 2>&1 | Out-String
    if ($ver -match 'Python\s+3') {
      $python = $cmd
      break
    }
  } catch {
    # 这个命令不存在，试下一个
  }
}

if ($python) {
  & $python (Join-Path $root 'tools\compose-cover.py')
} else {
  Write-Host '没找到可用的 Python，跳过封面图合成（00-悬浮球与面板.png）。' -ForegroundColor Yellow
  Write-Host '装好 Python 3 与 Pillow 后，单独运行：python tools\compose-cover.py'
}

Write-Host ''
Write-Host '全部完成，图片在 screenshots 目录。' -ForegroundColor Green
