# 我的小程序网站 - 部署指南

这是一个简单的静态网站，包含多个网页小程序。

## 📁 文件结构

```
my-website/
├── index.html          # 网站主页
├── apps/               # 小程序文件夹
│   └── 人生K线图.html  # 人生K线图小程序
└── README.md          # 说明文档
```

## 🚀 如何部署到网上（免费方案）

### 方案一：GitHub Pages（推荐，最简单）

**优点：**
- ✅ 完全免费
- ✅ 不需要服务器
- ✅ 自动HTTPS（安全）
- ✅ 全球可访问（不需要VPN）
- ✅ 操作简单

**步骤：**

1. **注册GitHub账号**
   - 访问 https://github.com
   - 点击右上角 "Sign up" 注册账号（免费）

2. **创建新仓库**
   - 登录后，点击右上角 "+" → "New repository"
   - Repository name: `my-website`（或任意名字）
   - 选择 Public（公开）
   - 点击 "Create repository"

3. **上传文件**
   - 下载并安装 GitHub Desktop（图形界面，最简单）
   - 下载地址：https://desktop.github.com
   - 或者使用网页版上传：
     - 在仓库页面点击 "uploading an existing file"
     - 拖拽整个 `my-website` 文件夹里的所有文件
     - 点击 "Commit changes"

4. **开启GitHub Pages**
   - 在仓库页面，点击 "Settings"（设置）
   - 左侧菜单找到 "Pages"
   - Source 选择 "main" 分支，文件夹选择 "/ (root)"
   - 点击 "Save"
   - 等待1-2分钟，会显示你的网站地址：`https://你的用户名.github.io/my-website`

5. **访问网站**
   - 打开浏览器，输入你的网站地址
   - 全世界都可以访问！

**更新网站：**
- 修改文件后，在GitHub Desktop中点击 "Commit" 和 "Push"
- 几分钟后网站自动更新

---

### 方案二：Vercel（备选方案）

**优点：**
- ✅ 免费
- ✅ 部署更快
- ✅ 自动HTTPS

**步骤：**
1. 访问 https://vercel.com
2. 用GitHub账号登录
3. 点击 "Add New Project"
4. 导入你的GitHub仓库
5. 点击 "Deploy"
6. 完成！会给你一个网址

---

### 方案三：Netlify（备选方案）

**优点：**
- ✅ 免费
- ✅ 操作简单

**步骤：**
1. 访问 https://www.netlify.com
2. 注册账号
3. 拖拽 `my-website` 文件夹到页面
4. 完成！会给你一个网址

---

## 📝 添加新小程序

1. 将新的HTML文件放到 `apps/` 文件夹
2. 在 `index.html` 中添加新的卡片：

```html
<a href="apps/你的小程序.html" class="app-card">
    <span class="icon">🎯</span>
    <h2>小程序名称</h2>
    <p>小程序描述</p>
    <span class="tag">已上线</span>
</a>
```

3. 上传到GitHub，网站自动更新

---

## 💡 常见问题

**Q: 网站地址可以自定义吗？**
A: GitHub Pages可以，在Settings → Pages → Custom domain设置

**Q: 需要付费吗？**
A: 不需要，以上方案都免费

**Q: 网站会被删除吗？**
A: 不会，只要你的GitHub账号存在，网站就一直在线

**Q: 可以绑定自己的域名吗？**
A: 可以，在GitHub Pages设置中添加自定义域名

---

## 🎉 开始使用

选择上面的任意一个方案，按照步骤操作，10分钟内就能让你的网站上线！

有问题可以随时问我！
