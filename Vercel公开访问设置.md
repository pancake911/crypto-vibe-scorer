# Vercel 公开访问设置指南

## 问题
你分享的URL `https://crypto-vibe-scorer-git-main-q10336951s-projects.vercel.app/` 是预览部署URL，可能需要登录才能访问。

## 解决方案

### 方法1: 使用生产部署URL（推荐）

1. **登录Vercel Dashboard**
   - 访问：https://vercel.com/dashboard
   - 登录你的账号

2. **找到你的项目**
   - 点击项目：`crypto-vibe-scorer`

3. **查看生产部署**
   - 在项目页面，找到 "Production" 标签
   - 点击最新的生产部署
   - 查看URL，应该是类似：`https://crypto-vibe-scorer.vercel.app`（没有 `-git-main-` 部分）

4. **如果没有生产部署**
   - 在项目设置（Settings）中
   - 找到 "Git" 部分
   - 确保 "Production Branch" 设置为 `main`
   - 然后重新部署一次

### 方法2: 设置自定义域名（最佳方案）

1. **在Vercel Dashboard中**
   - 进入项目设置（Settings）
   - 点击 "Domains"
   - 添加你的域名（如果有）

2. **或者使用Vercel提供的免费域名**
   - 生产部署会自动获得一个公开URL
   - 格式：`https://你的项目名.vercel.app`

### 方法3: 确保部署是公开的

1. **检查项目设置**
   - Settings → General
   - 确保 "Visibility" 设置为 "Public"（公开）

2. **检查部署设置**
   - Settings → Git
   - 确保 "Production Branch" 是 `main`

## 快速检查

### 步骤1: 找到正确的URL

在Vercel Dashboard中：
1. 进入项目
2. 查看 "Deployments" 标签
3. 找到标记为 "Production" 的部署（不是 "Preview"）
4. 点击该部署，查看URL

**正确的URL格式应该是**：
- ✅ `https://crypto-vibe-scorer.vercel.app`（生产URL）
- ❌ `https://crypto-vibe-scorer-git-main-xxx.vercel.app`（预览URL）

### 步骤2: 测试访问

1. **在无痕模式下打开URL**（确保没有登录Vercel）
2. **或者用手机浏览器打开**（确保没有登录）
3. **应该可以直接访问，不需要登录**

## 如果仍然需要登录

### 可能的原因：
1. **项目设置为私有**（需要改为公开）
2. **访问的是预览URL**（需要使用生产URL）
3. **Vercel账号设置问题**

### 解决方法：
1. **检查项目可见性**：
   - Settings → General → Visibility → 改为 "Public"

2. **创建生产部署**：
   - 在项目页面，点击 "Promote to Production"
   - 或者重新部署一次

3. **使用生产URL**：
   - 确保使用 `xxx.vercel.app` 格式的URL
   - 而不是 `xxx-git-xxx.vercel.app` 格式

## 推荐操作

1. **登录Vercel Dashboard**
2. **进入项目设置**
3. **确保 "Production Branch" 是 `main`**
4. **确保项目是 "Public"**
5. **找到生产部署URL并分享**

## 验证

分享URL后，让别人在**无痕模式**或**未登录Vercel的浏览器**中打开，应该可以直接访问。

