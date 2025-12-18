# Binance API 代理服务器

## 快速部署到Railway（免费）

1. 注册Railway账号: https://railway.app
2. 创建新项目
3. 连接GitHub仓库或直接部署
4. Railway会自动检测Node.js项目并部署
5. 获取部署后的URL（例如: https://your-app.railway.app）
6. 在Vercel中配置环境变量: `PROXY_SERVER_URL=https://your-app.railway.app`

## 快速部署到Render（免费）

1. 注册Render账号: https://render.com
2. 创建新的Web Service
3. 连接GitHub仓库或直接部署
4. 获取部署后的URL
5. 在Vercel中配置环境变量

## 成本

- **Railway免费层**: 每月$5额度，足够个人项目使用
- **Render免费层**: 有限制，但足够测试
- **VPS (DigitalOcean/Vultr)**: $5-6/月，更稳定

## 使用说明

部署后，在Vercel项目设置中添加环境变量：
```
PROXY_SERVER_URL=https://your-proxy-server.com
```

重启Vercel部署，代理会自动生效。

