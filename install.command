#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [ -x "$HOME/.bun/bin/bun" ]; then
  bunExecutable="$HOME/.bun/bin/bun"
elif command -v bun >/dev/null 2>&1; then
  bunExecutable="$(command -v bun)"
else
  echo "正在从 bun.sh 安装运行环境，不下载 AI 模型。"
  curl --fail --show-error --location https://bun.sh/install -o "${TMPDIR:-/tmp}/yijuchengpianBunInstall.sh"
  bash "${TMPDIR:-/tmp}/yijuchengpianBunInstall.sh"
  bunExecutable="$HOME/.bun/bin/bun"
fi
export PATH="$(dirname "$bunExecutable"):$PATH"
"$bunExecutable" install --frozen-lockfile
"$bunExecutable" run setup
echo "安装完成。请阅读 docs/start.md。"
