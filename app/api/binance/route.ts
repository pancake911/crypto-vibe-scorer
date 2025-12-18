import { NextRequest, NextResponse } from 'next/server';
import ccxt from 'ccxt';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol') || 'BTC/USDT';
    const period = searchParams.get('period') || '5m'; // 获取用户选择的周期
    
    const exchange = new ccxt.binance({
      enableRateLimit: true,
      options: {
        defaultType: 'future', // 使用期货市场
      },
    });

    // 获取资金费率（优先使用直接API调用，更可靠）
    let fundingRateValue = null;
    let fundingRateTimestamp = Date.now();
    try {
      const baseSymbol = symbol.replace('/', '');
      // 直接调用Binance API获取资金费率（3秒超时）
      const response = await fetchWithTimeout(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${baseSymbol}`, {
        timeout: 3000,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.lastFundingRate !== undefined) {
        fundingRateValue = parseFloat(data.lastFundingRate) * 100; // 转换为百分比
        fundingRateTimestamp = data.time || Date.now();
      } else {
        throw new Error('资金费率数据格式错误');
      }
    } catch (e: any) {
      console.error('直接API获取资金费率失败:', e.message);
      // 备用方案：使用ccxt
      try {
        const fundingRateData = await exchange.fetchFundingRate(symbol);
        if (Array.isArray(fundingRateData)) {
          fundingRateValue = fundingRateData[0].rate * 100;
          fundingRateTimestamp = fundingRateData[0].timestamp;
        } else {
          // 处理非数组情况，使用类型断言
          const rateData = fundingRateData as any;
          if (rateData && typeof rateData.rate === 'number') {
            fundingRateValue = rateData.rate * 100;
            fundingRateTimestamp = rateData.timestamp || Date.now();
          }
        }
      } catch (e2: any) {
        console.error('ccxt获取资金费率也失败:', e2.message);
      }
    }
    
    // 获取多空持仓比（使用Binance公开API，根据用户选择的周期）
    let longShortRatio = null;
    let longShortRatioPeriod = period; // 使用用户选择的周期
    try {
      const baseSymbol = symbol.replace('/', '');
      // 使用Binance的Global Long/Short Ratio API
      // period可选值: 5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d
      // 使用用户选择的周期（3秒超时）
      const ratioResponse = await fetchWithTimeout(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${baseSymbol}&period=${period}&limit=1`, {
        timeout: 3000,
      });
      if (ratioResponse.ok) {
        const ratioData = await ratioResponse.json();
        if (ratioData && ratioData.length > 0) {
          longShortRatio = parseFloat(ratioData[0].longShortRatio);
        }
      }
    } catch (e: any) {
      console.log('无法获取多空持仓比:', e.message);
      // 如果获取失败，设置为null，前端会显示"数据不可用"
    }

    // 获取24小时ticker数据
    let price = null;
    let volume24h = null;
    try {
      const ticker = await exchange.fetchTicker(symbol);
      price = ticker.last;
      volume24h = ticker.quoteVolume;
    } catch (e: any) {
      console.error('获取价格失败:', e.message);
      // 如果失败，尝试直接调用Binance API
      try {
        const baseSymbol = symbol.replace('/', '');
        const tickerResponse = await fetchWithTimeout(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${baseSymbol}`, {
          timeout: 3000,
        });
        const tickerData = await tickerResponse.json();
        price = parseFloat(tickerData.lastPrice);
        volume24h = parseFloat(tickerData.quoteVolume);
      } catch (e2) {
        console.error('备用价格获取也失败:', e2);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        symbol: symbol.replace('/', ''),
        fundingRate: fundingRateValue,
        fundingRateTimestamp: fundingRateTimestamp,
        price,
        volume24h,
        longShortRatio, // 如果获取不到则为null
        longShortRatioPeriod: longShortRatioPeriod, // 多空持仓比周期
      },
    });
  } catch (error: any) {
    console.error('Binance API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取数据失败',
      },
      { status: 500 }
    );
  }
}
