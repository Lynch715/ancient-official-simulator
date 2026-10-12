#!/bin/zsh
cd "$(dirname "$0")" || exit 1
echo "清河初任：请在浏览器打开 http://127.0.0.1:8765"
echo "关闭此窗口即可停止本地服务。"
python3 -m http.server 8765 --bind 127.0.0.1
