// 简单的Binance API代理服务器
// 部署到Railway, Render, 或任何Node.js服务器

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// 健康检查
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Binance API Proxy Server' });
});

// 代理端点
app.get('/proxy', async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  
  // 只允许Binance API
  if (!url.startsWith('https://fapi.binance.com/') && !url.startsWith('https://api.binance.com/')) {
    return res.status(400).json({ error: 'Invalid URL. Only Binance API allowed' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `API returned ${response.status}`,
        status: response.status,
      });
    }
    
    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message || 'Proxy request failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});

