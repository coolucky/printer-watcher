#!/bin/bash

# 备份依赖脚本
echo "========================================"
echo "备份依赖脚本"
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

# 创建依赖备份目录
if [ ! -d "node_modules_backup" ]; then
    echo "创建依赖备份目录..."
    mkdir -p node_modules_backup
fi

# 备份前端依赖
echo "备份前端依赖..."
# 只安装生产依赖，跳过devDependencies（包括electron）
npm install --only=prod
if [ $? -eq 0 ]; then
    echo "前端依赖安装成功，开始备份..."
    rm -rf node_modules_backup/frontend
    cp -r node_modules node_modules_backup/frontend
    echo "前端依赖备份完成"
else
    echo "错误: 前端依赖安装失败"
    exit 1
fi

# 进入后端目录
cd backend

# 备份后端依赖
echo "备份后端依赖..."
npm install
if [ $? -eq 0 ]; then
    echo "后端依赖安装成功，开始备份..."
    rm -rf ../node_modules_backup/backend
    cp -r node_modules ../node_modules_backup/backend
    echo "后端依赖备份完成"
else
    echo "错误: 后端依赖安装失败"
    exit 1
fi

# 返回前端目录
cd ..

echo "========================================"
echo "依赖备份完成！"
echo "已备份到 node_modules_backup 目录"
echo "========================================"
echo "现在可以将整个项目目录复制到离线环境中使用"