#!/bin/bash

# 停止服务脚本
echo "========================================"
echo "Printer Status Report 服务停止脚本"
echo "========================================"

# 停止前端服务器
echo "停止前端服务器..."
if pgrep -f "vite" > /dev/null; then
    pkill -f "vite"
    echo "前端服务器已停止"
else
    echo "前端服务器未运行"
fi

# 停止后端服务器
echo "停止后端服务器..."
if pgrep -f "node server.js" > /dev/null; then
    pkill -f "node server.js"
    echo "后端服务器已停止"
else
    echo "后端服务器未运行"
fi

echo "========================================"
echo "服务停止完成！"
echo "========================================"