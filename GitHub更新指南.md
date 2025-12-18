# 📚 GitHub更新网站 - 超详细小白教程

## 方法一：GitHub网页版更新（最简单，推荐）

### 第一步：打开你的GitHub仓库

1. 打开浏览器，访问 https://github.com
2. 登录你的账号
3. 找到你的 `my-website` 仓库，点击进入

### 第二步：删除旧文件（如果有的话）

1. 在仓库页面，找到 `index.html` 文件
2. 点击 `index.html` 文件名
3. 点击右上角的垃圾桶图标 🗑️（Delete file）
4. 在底部输入框输入 `delete` 确认
5. 点击 "Commit changes" 按钮

**注意：** 如果仓库里已经有文件，需要先删除再上传新的

### 第三步：上传新文件

1. 在仓库页面，点击绿色的 "Add file" 按钮
2. 选择 "Upload files"
3. **重要：** 打开你的电脑桌面，找到 `cursor` 文件夹 → `my-website` 文件夹
4. **拖拽整个文件夹里的所有文件**到GitHub页面上：
   - `index.html`
   - `README.md`
   - `apps` 文件夹（整个文件夹）
   - 其他所有文件
5. 拖拽完成后，在页面底部：
   - 第一个输入框写：`更新网站设计`（或任意描述）
   - 点击绿色的 "Commit changes" 按钮
6. 等待上传完成（会显示进度条）

### 第四步：检查网站

1. 上传完成后，点击仓库顶部的 "Settings"
2. 左侧找到 "Pages"
3. 确认显示 "Your site is live at..."
4. 点击链接，查看你的网站

---

## 方法二：使用GitHub Desktop（更简单，推荐长期使用）

### 第一步：下载GitHub Desktop

1. 访问：https://desktop.github.com
2. 点击 "Download for macOS"（如果你是Mac）或 "Download for Windows"
3. 下载完成后，安装软件
4. 打开GitHub Desktop，用你的GitHub账号登录

### 第二步：克隆仓库到本地

1. 在GitHub Desktop中，点击左上角 "File" → "Clone repository"
2. 选择你的 `my-website` 仓库
3. 选择保存位置（建议选择桌面）
4. 点击 "Clone"

### 第三步：更新文件

1. 打开GitHub Desktop
2. 在左侧找到你的 `my-website` 仓库，点击
3. 点击 "Show in Finder"（Mac）或 "Show in Explorer"（Windows）
4. 会打开一个文件夹，这就是你的GitHub仓库文件夹
5. **把桌面 `cursor/my-website` 文件夹里的所有文件，复制粘贴到这个文件夹里**
   - 替换旧的 `index.html`
   - 替换旧的 `README.md`
   - 替换 `apps` 文件夹里的内容

### 第四步：提交更新

1. 回到GitHub Desktop
2. 左侧会显示你修改的文件（显示为绿色或黄色）
3. 在左下角输入框写：`更新网站设计`（或任意描述）
4. 点击 "Commit to main" 按钮
5. 点击右上角的 "Push origin" 按钮
6. 等待上传完成

### 第五步：检查网站

1. 等待1-2分钟
2. 访问你的网站地址：`https://你的用户名.github.io/my-website`
3. 刷新页面，应该看到新设计

---

## 🎯 快速检查清单

更新后检查这些：

- [ ] 网站能正常打开吗？
- [ ] 分类按钮能正常切换吗？
- [ ] 人生K线图能正常打开吗？
- [ ] 尾部显示抖音号了吗？
- [ ] 网站标题是"每天与AI做一个有趣的程序"吗？

---

## ❓ 常见问题

### Q: 上传后网站没有变化？
A: 等待2-3分钟，然后强制刷新浏览器（按 Ctrl+F5 或 Cmd+Shift+R）

### Q: 上传文件时提示"文件已存在"？
A: 先删除旧文件，再上传新文件

### Q: 找不到"Add file"按钮？
A: 确保你在仓库的主页面，不是在看某个文件

### Q: 上传后显示错误？
A: 确保 `index.html` 在根目录，`apps` 文件夹也在根目录

---

## 💡 小贴士

- **每次更新网站都用同样的方法**
- **建议使用方法二（GitHub Desktop）**，以后更新更方便
- **更新后等待1-2分钟再查看网站**
- **如果网站没变化，清除浏览器缓存再试**

---

## 🆘 如果还是不会

告诉我：
1. 你卡在哪一步？
2. 看到了什么错误信息？
3. 截图发给我，我帮你解决！

