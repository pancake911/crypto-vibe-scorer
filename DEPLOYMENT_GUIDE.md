# 部署指南 - 如何将应用分享给他人使用

本指南将帮助你将 Crypto Vibe Scorer 部署到互联网上，让其他人可以通过网页链接访问。

## 🚀 推荐方式：Vercel部署（最简单）

Vercel是Next.js的官方推荐平台，部署过程非常简单，完全免费。

### 第一步：准备GitHub仓库

1. **如果没有GitHub账号，先注册**
   - 访问 https://github.com
   - 点击"Sign up"注册账号

2. **创建新仓库**
   - 登录GitHub后，点击右上角"+" -> "New repository"
   - Repository name: `crypto-vibe-scorer`（或其他你喜欢的名字）
   - 选择"Public"（公开，这样Vercel才能访问）
   - 点击"Create repository"

3. **上传代码到GitHub**
   
   在项目文件夹中打开终端，执行以下命令：

   ```bash
   # 初始化Git（如果还没有）
   git init
   
   # 添加所有文件
   git add .
   
   # 提交代码
   git commit -m "Initial commit - v3.0"
   
   # 添加GitHub远程仓库（替换YOUR_USERNAME为你的GitHub用户名）
   git remote add origin https://github.com/YOUR_USERNAME/crypto-vibe-scorer.git
   
   # 推送代码到GitHub
   git branch -M main
   git push -u origin main
   ```

### 第二步：部署到Vercel

1. **注册Vercel账号**
   - 访问 https://vercel.com
   - 点击"Sign Up"
   - 选择"Continue with GitHub"（使用GitHub账号登录，最简单）

2. **导入项目**
   - 登录后，点击"Add New..." -> "Project"
   - 在"Import Git Repository"中，选择你的`crypto-vibe-scorer`仓库
   - 点击"Import"

3. **配置项目**
   - Vercel会自动检测到这是Next.js项目
   - Framework Preset: Next.js（应该自动选择）
   - Root Directory: `./`（默认即可）
   - Build Command: `npm run build`（默认即可）
   - Output Directory: `.next`（默认即可）
   - Install Command: `npm install`（默认即可）

4. **环境变量（可选）**
   - 如果你的项目需要API密钥，可以在这里添加
   - 当前版本不需要额外的环境变量

5. **部署**
   - 点击"Deploy"按钮
   - 等待2-3分钟，Vercel会自动构建和部署你的项目

6. **获取网址**
   - 部署完成后，你会看到一个"Congratulations!"页面
   - 你的网站网址会是：`https://crypto-vibe-scorer.vercel.app`（或类似）
   - 点击这个链接就可以访问你的网站了！

### 第三步：分享给他人

- 将你的Vercel网址分享给任何人
- 他们可以直接在浏览器中打开使用
- 不需要任何安装或配置

### 自动更新

- 每次你向GitHub推送新代码时，Vercel会自动重新部署
- 你的网站会自动更新到最新版本

---

## 🌐 其他部署方式

### Netlify部署

1. 访问 https://netlify.com 并注册
2. 点击"Add new site" -> "Import an existing project"
3. 选择GitHub仓库
4. 构建设置：
   - Build command: `npm run build`
   - Publish directory: `.next`
5. 点击"Deploy site"

### Railway部署

1. 访问 https://railway.app 并注册
2. 点击"New Project" -> "Deploy from GitHub repo"
3. 选择你的仓库
4. Railway会自动检测并部署

---

## 📝 部署前检查清单

- [ ] 代码已提交到GitHub
- [ ] 确保`package.json`中的版本号正确
- [ ] 测试本地运行：`npm run build` 和 `npm start`
- [ ] 检查是否有敏感信息（API密钥等）需要设置为环境变量

## 🔒 安全提示

- 不要将API密钥直接写在代码中
- 如果将来需要API密钥，使用环境变量
- Vercel支持在项目设置中添加环境变量

## ❓ 常见问题

### Q: 部署后网站无法访问？
A: 检查以下几点：
- 确保GitHub仓库是Public
- 检查Vercel部署日志是否有错误
- 确保`package.json`中的依赖都正确

### Q: 如何更新网站？
A: 只需要：
1. 修改本地代码
2. 提交到GitHub：`git add .` -> `git commit -m "更新说明"` -> `git push`
3. Vercel会自动重新部署

### Q: 可以自定义域名吗？
A: 可以！在Vercel项目设置中，可以添加自定义域名（需要购买域名）

### Q: 部署是免费的吗？
A: Vercel的免费套餐对个人项目完全够用，包括：
- 无限部署
- 全球CDN
- 自动HTTPS
- 100GB带宽/月

---

## 🎉 完成！

部署完成后，你的应用就可以通过网页链接分享给任何人使用了！

