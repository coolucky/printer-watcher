#!/bin/bash

# 启动服务脚本
echo "========================================"
echo "Printer Status Report 服务启动脚本"
echo "========================================"

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "错误: Node.js 未安装，请先安装 Node.js 18 或更高版本"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "错误: npm 未安装，请先安装 Node.js 18 或更高版本"
    exit 1
fi

echo "Node.js 版本: $(node -v)"
echo "npm 版本: $(npm -v)"

# 检查并创建依赖备份目录
if [ ! -d "node_modules_backup" ]; then
    echo "创建依赖备份目录..."
    mkdir -p node_modules_backup
fi

# 检查前端依赖
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
    echo "安装前端依赖..."
    if [ -d "node_modules_backup/frontend" ]; then
        echo "从备份恢复前端依赖..."
        cp -r node_modules_backup/frontend node_modules
    else
        echo "从npm安装前端依赖..."
        npm install
        # 备份依赖
        echo "备份前端依赖..."
        cp -r node_modules node_modules_backup/frontend
    fi
else
    echo "前端依赖已存在，跳过安装"
fi

# 检查后端目录
if [ ! -d "backend" ]; then
    echo "错误: backend 目录不存在"
    exit 1
fi

# 进入后端目录
cd backend

# 检查后端依赖
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
    echo "安装后端依赖..."
    if [ -d "../node_modules_backup/backend" ]; then
        echo "从备份恢复后端依赖..."
        cp -r ../node_modules_backup/backend node_modules
    else
        echo "从npm安装后端依赖..."
        npm install
        # 备份依赖
        echo "备份后端依赖..."
        cp -r node_modules ../node_modules_backup/backend
    fi
else
    echo "后端依赖已存在，跳过安装"
fi

# 启动后端服务器
echo "启动后端服务器..."
nohup node server.js > ../backend.log 2>&1 &

# 等待后端服务器启动
sleep 3

# 检查后端服务器是否启动
if ! pgrep -f "node server.js" > /dev/null; then
    echo "错误: 后端服务器启动失败，请查看 backend.log"
    exit 1
fi

echo "后端服务器已启动"

# 返回前端目录
cd ..

# 启动前端服务器
echo "启动前端服务器..."
nohup npm run dev > frontend.log 2>&1 &

# 等待前端服务器启动
sleep 3

# 检查前端服务器是否启动
if ! pgrep -f "vite" > /dev/null; then
    echo "错误: 前端服务器启动失败，请查看 frontend.log"
    exit 1
fi

echo "前端服务器已启动"

# 打开预览页面
echo "打开预览页面..."
if command -v open &> /dev/null; then
    open http://localhost:5173/
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5173/
elif command -v start &> /dev/null; then
    start http://localhost:5173/
else
    echo "请手动打开浏览器访问: http://localhost:5173/"
fi

echo "========================================"
echo "服务启动完成！"
echo "前端地址: http://localhost:5173/"
echo "后端地址: http://localhost:3001/"
echo "========================================"
echo "如需停止服务，请运行: ./stop-service.sh"