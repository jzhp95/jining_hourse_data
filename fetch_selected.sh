#!/bin/bash

echo "开始抓取指定小区数据..."
echo ""

pnpm run query 00000139
echo "等待 3 秒..."
sleep 3

pnpm run query 00000129
echo "等待 3 秒..."
sleep 3

pnpm run query 00000136
echo "等待 3 秒..."
sleep 3

pnpm run query 00001303
echo "等待 3 秒..."
sleep 3

pnpm run query 00001312
echo "等待 3 秒..."
sleep 3

pnpm run query 00001267
echo "等待 3 秒..."
sleep 3

pnpm run query 00000145
echo "等待 3 秒..."
sleep 3

pnpm run query 00000132
echo "等待 3 秒..."
sleep 3

pnpm run query 00000150

echo ""
echo "全部完成！"
