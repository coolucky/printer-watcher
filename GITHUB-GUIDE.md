# GitHub 操作指南

## 目录
1. [新电脑克隆项目](#1-新电脑克隆项目)
2. [日常开发工作流](#2-日常开发工作流)
3. [分支管理](#3-分支管理)
4. [版本回退](#4-版本回退)
5. [常用命令速查](#5-常用命令速查)
6. [SSH 密钥配置](#6-ssh-密钥配置)
7. [.gitignore 说明](#7-gitignore-说明)
8. [常见问题](#8-常见问题)

---

## 1. 新电脑克隆项目

### 前提条件
- 安装 Git: https://git-scm.com/downloads
- 配置 SSH 密钥（见第6节）

### 克隆步骤

```bash
# 1. 克隆仓库到本地
git clone git@github.gopayinc.com.cn:BITS-CorpIT-Config/printer-status-report.git

# 2. 进入项目目录
cd printer-status-report

# 3. 安装前端依赖
npm install

# 4. 安装后端依赖
cd backend
npm install
cd ..

# 5. 启动开发服务器
cd backend && node server.js &
cd .. && npx vite --port 5175
```

---

## 2. 日常开发工作流

### 修改代码后提交推送

```bash
# 1. 查看哪些文件被修改了
git status

# 2. 添加所有修改到暂存区
git add -A
# 或者只添加特定文件
git add src/components/StatusDashboard.jsx

# 3. 提交 (写清楚做了什么)
git commit -m "feat: 新增打印机日志查询功能"

# 4. 推送到 GitHub
git push origin main
```

### 拉取最新代码（多人协作或多设备）

```bash
# 拉取远程最新代码并合并
git pull origin main
```

### Commit Message 规范（建议）

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feat:` | 新功能 | `feat: add system update feature` |
| `fix:` | 修复bug | `fix: resolve timeline bar rendering` |
| `style:` | 样式调整 | `style: align Logs button` |
| `refactor:` | 重构 | `refactor: extract email service` |
| `docs:` | 文档 | `docs: update deployment guide` |
| `chore:` | 杂项 | `chore: update dependencies` |

---

## 3. 分支管理

### 为什么用分支？
- 开发新功能时不影响主分支的稳定性
- 多人协作时避免冲突

### 基本操作

```bash
# 查看所有分支
git branch -a

# 创建并切换到新分支
git checkout -b feature/new-alert-system

# 在新分支上开发...修改代码...
git add -A
git commit -m "feat: implement new alert system"

# 推送新分支到 GitHub
git push origin feature/new-alert-system

# 开发完成后，切回 main 分支并合并
git checkout main
git pull origin main
git merge feature/new-alert-system

# 推送合并后的 main
git push origin main

# 删除已合并的分支（可选）
git branch -d feature/new-alert-system
git push origin --delete feature/new-alert-system
```

---

## 4. 版本回退

### 查看历史

```bash
# 查看提交历史 (简洁版)
git log --oneline -10

# 查看详细历史
git log --oneline --graph --all

# 查看某个文件的修改历史
git log --oneline -- src/components/SettingsPanel.jsx
```

### 回退操作

```bash
# 查看某次提交修改了什么
git show abc1234

# 撤销最近一次提交（保留修改在工作区）
git reset --soft HEAD~1

# 彻底回退到某个版本（⚠️ 会丢失之后的修改）
git reset --hard abc1234

# 安全方式：创建新提交来撤销某次修改
git revert abc1234
```

### 暂存工作区（临时切换任务）

```bash
# 暂存当前修改
git stash

# 做其他事情...

# 恢复暂存的修改
git stash pop

# 查看暂存列表
git stash list
```

---

## 5. 常用命令速查

| 命令 | 作用 |
|------|------|
| `git status` | 查看当前状态 |
| `git add -A` | 添加所有更改 |
| `git commit -m "msg"` | 提交 |
| `git push origin main` | 推送到远程 |
| `git pull origin main` | 拉取远程更新 |
| `git log --oneline -5` | 查看最近5条提交 |
| `git diff` | 查看未暂存的修改 |
| `git diff --staged` | 查看已暂存的修改 |
| `git checkout -- file` | 丢弃某文件的修改 |
| `git branch` | 查看分支 |
| `git remote -v` | 查看远程仓库地址 |
| `git clone <url>` | 克隆仓库 |
| `git stash` | 暂存修改 |

---

## 6. SSH 密钥配置

### 新电脑首次使用 GitHub 需要配置 SSH

```bash
# 1. 生成 SSH 密钥
ssh-keygen -t ed25519 -C "your-email@example.com"
# 一路回车使用默认设置

# 2. 查看公钥内容
cat ~/.ssh/id_ed25519.pub

# 3. 复制输出的内容，然后：
#    - 打开 GitHub → Settings → SSH and GPG keys → New SSH key
#    - 粘贴公钥，保存

# 4. 测试连接
ssh -T git@github.gopayinc.com.cn

# 5. 配置 Git 用户信息
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

### 如果用 HTTPS 而非 SSH

```bash
# 克隆时使用 HTTPS 地址
git clone https://github.gopayinc.com.cn/BITS-CorpIT-Config/printer-status-report.git

# 首次推送时会提示输入用户名和密码/Token
# 建议使用 Personal Access Token (PAT) 代替密码
# GitHub → Settings → Developer settings → Personal access tokens → Generate
```

---

## 7. .gitignore 说明

`.gitignore` 文件告诉 Git 哪些文件不需要上传：

```
node_modules/    # 依赖包（太大，别人 npm install 即可）
dist/            # 构建产物（可重新生成）
*.log            # 日志文件
.env             # 环境变量（可能含敏感信息）
.DS_Store        # macOS 系统文件
```

### 如果不小心提交了不该提交的文件

```bash
# 从 Git 跟踪中移除（但保留本地文件）
git rm --cached path/to/file
git commit -m "chore: remove tracked file"
git push
```

---

## 8. 常见问题

### Q: push 被拒绝 (rejected)
```bash
# 远程有新提交，先拉取再推送
git pull origin main --rebase
git push origin main
```

### Q: 合并冲突 (merge conflict)
```bash
# 1. 打开冲突文件，手动编辑（删除 <<<< ==== >>>> 标记）
# 2. 编辑完成后
git add -A
git commit -m "fix: resolve merge conflict"
git push
```

### Q: 想撤销 git add（还没 commit）
```bash
git reset HEAD file.js    # 撤销单个文件
git reset HEAD            # 撤销所有
```

### Q: 忘记切分支就开始写代码了
```bash
# 把当前修改转移到新分支
git stash
git checkout -b feature/my-work
git stash pop
```

### Q: 查看远程仓库信息
```bash
git remote show origin
```

---

## 本项目特定信息

| 项目 | 值 |
|------|------|
| 仓库地址 | `git@github.gopayinc.com.cn:BITS-CorpIT-Config/printer-status-report.git` |
| 主分支 | `main` |
| 前端端口 | 5175 |
| 后端端口 | 3001 |
| 离线包路径 | `deploy/printer-status-report-offline-*.zip` |
| 打包命令 | `cd deploy && bash pack-offline.sh` |
