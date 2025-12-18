import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol') || 'BTC';
    
    // 尝试从多个数据源获取ETF数据
    let etfFlow = null;
    
    try {
      if (symbol.toUpperCase() === 'BTC') {
        // 方法1: 尝试使用Coinglass API（如果有API密钥）
        // 注意：Coinglass API需要付费，这里提供一个框架
        const coinglassApiKey = process.env.COINGLASS_API_KEY;
        
        if (coinglassApiKey) {
          try {
            // Coinglass API调用示例
            const response = await fetch('https://open-api-v4.coinglass.com/api/bitcoin/etf/flow-history', {
              headers: {
                'accept': 'application/json',
                'coinglassSecret': coinglassApiKey,
              },
              next: { revalidate: 300 }, // 缓存5分钟
            });
            
            if (response.ok) {
              const data = await response.json();
              // 解析数据，获取今日净流入（需要根据实际API响应格式调整）
              if (data.data && data.data.length > 0) {
                // 获取最新一天的数据
                const latest = data.data[0];
                // 计算净流入（单位：亿美元）
                // 注意：需要根据实际API返回的字段调整
                etfFlow = latest.netFlow ? latest.netFlow / 100000000 : null; // 转换为亿美元
              }
            }
          } catch (e: any) {
            console.log('Coinglass API调用失败:', e.message);
          }
        }
        
        // 方法2: 如果没有API密钥，尝试从其他免费数据源获取
        // 注意：目前没有完全免费的ETF数据API，这里提供一个占位符
        // 实际使用时，建议：
        // 1. 注册Coinglass API（付费但数据准确）
        // 2. 或者使用网页爬虫解析Coinglass页面（可能违反服务条款）
        // 3. 或者让用户手动输入
        
      } else if (symbol.toUpperCase() === 'ETH') {
        // ETH ETF数据类似处理
        const coinglassApiKey = process.env.COINGLASS_API_KEY;
        
        if (coinglassApiKey) {
          try {
            const response = await fetch('https://open-api-v4.coinglass.com/api/ethereum/etf/flow-history', {
              headers: {
                'accept': 'application/json',
                'coinglassSecret': coinglassApiKey,
              },
              next: { revalidate: 300 },
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.data && data.data.length > 0) {
                const latest = data.data[0];
                etfFlow = latest.netFlow ? latest.netFlow / 100000000 : null;
              }
            }
          } catch (e: any) {
            console.log('ETH ETF API调用失败:', e.message);
          }
        }
      }
    } catch (e: any) {
      console.log('获取ETF数据失败:', e.message);
    }

    // 返回结果
    return NextResponse.json({
      success: etfFlow !== null,
      data: {
        symbol: symbol.toUpperCase(),
        etfFlow: etfFlow, // 单位：亿美元，如果为null则需要手动输入
        message: etfFlow === null 
          ? '无法自动获取ETF数据（需要Coinglass API密钥），请手动输入或访问Coinglass查询' 
          : '数据获取成功',
      },
    });
  } catch (error: any) {
    console.error('ETF API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取ETF数据失败',
      },
      { status: 500 }
    );
  }
}

