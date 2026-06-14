#!/bin/bash

echo "========================================="
echo "  自动抓取数据并分析售卖情况"
echo "========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "📡 开始抓取9个小区数据..."
echo ""

bash "${SCRIPT_DIR}/fetch_selected.sh"

echo ""
echo "========================================="
echo "  开始分析售卖情况"
echo "========================================="
echo ""

cd "${SCRIPT_DIR}" && node analyze_all.js

echo ""
echo "========================================="
echo "  成交动态 - 具体房源变化"
echo "========================================="
echo ""

cd "${SCRIPT_DIR}" && node analyze_changes.js

echo ""
echo "========================================="
echo "  提交数据到远程仓库"
echo "========================================="
echo ""

cd "${SCRIPT_DIR}" && git add -f output/ && git diff --quiet && git diff --staged --quiet || \
  git commit -m "chore(data): 自动抓取更新 $(TZ=Asia/Shanghai date '+%Y%m%d %H:%M')" && \
  git push

echo ""
echo "========================================="
echo "  全部完成！"
echo "========================================="
