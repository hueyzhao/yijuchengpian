$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$bunExecutable = Join-Path $env:USERPROFILE '.bun\bin\bun.exe'
if (-not (Test-Path $bunExecutable)) {
  $existing = Get-Command bun -ErrorAction SilentlyContinue
  if ($existing) { $bunExecutable = $existing.Source }
  else {
    $installer = Join-Path $env:TEMP 'yijuchengpianBunInstall.ps1'
    Invoke-WebRequest 'https://bun.sh/install.ps1' -OutFile $installer
    & $installer
    if (-not (Test-Path $bunExecutable)) { throw 'Bun 安装未完成，请从 bun.sh 安装后重试。' }
  }
}
$env:PATH = (Split-Path $bunExecutable) + [IO.Path]::PathSeparator + $env:PATH
& $bunExecutable install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw '依赖安装失败' }
& $bunExecutable run setup
if ($LASTEXITCODE -ne 0) { throw '配置生成失败' }
