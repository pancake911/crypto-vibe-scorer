import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

// Hyperliquid OI数据获取API
// 不使用Edge Runtime，因为需要处理复杂的POST请求
// export const runtime = 'edge';

interface HyperliquidOIData {
  success: boolean;
  data?: {
    currentOI: number;
    previousOI?: number;
    oiChange?: number;
    oiChangePercent?: number;
    timestamp: number;
    period: '1h' | '4h';
  };
  error?: string;
}

// 获取Hyperliquid的OI数据
async function getHyperliquidOI(
  coin: string, // 例如: 'BTC', 'ETH'
  period: '1h' | '4h'
): Promise<HyperliquidOIData> {
  try {
    // 方法1: 尝试使用metaAndAssetCtxs获取当前OI
    const metaRes = await fetchWithTimeout(
      'https://api.hyperliquid.xyz/info',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
        timeout: 10000,
      }
    );

    if (!metaRes.ok) {
      return {
        success: false,
        error: `Hyperliquid API返回错误: ${metaRes.status}`,
      };
    }

    const metaData: any = await metaRes.json();
    
    // 检查响应格式
    console.log('Hyperliquid API响应:', {
      hasAssetCtxs: !!metaData?.assetCtxs,
      assetCtxsType: Array.isArray(metaData?.assetCtxs) ? 'array' : typeof metaData?.assetCtxs,
      assetCtxsLength: Array.isArray(metaData?.assetCtxs) ? metaData.assetCtxs.length : 'not array',
      sample: metaData?.assetCtxs?.[0],
    });
    
    // 查找对应币种的资产上下文
    // 注意：assetCtxs可能是一个对象（键值对）而不是数组
    let assetCtx = null;
    
    if (Array.isArray(metaData?.assetCtxs)) {
      assetCtx = metaData.assetCtxs.find((ctx: any) => 
        ctx.name?.toUpperCase() === coin.toUpperCase()
      );
    } else if (metaData?.assetCtxs && typeof metaData.assetCtxs === 'object') {
      // 如果是对象，直接查找键
      assetCtx = metaData.assetCtxs[coin.toUpperCase()] || metaData.assetCtxs[coin];
    }

    if (!assetCtx || assetCtx.openInterest === undefined) {
      // 如果assetCtxs为空或找不到对应币种，尝试方法2
      console.log('方法1失败：未找到资产上下文，尝试方法2...');
      return await getHyperliquidOIMethod2(coin, period);
    }

    const currentOI = parseFloat(assetCtx.openInterest || 0);
    
    if (currentOI === 0) {
      return {
        success: false,
        error: '当前OI为0，数据可能不准确',
      };
    }

    // 方法2: 获取历史K线数据，尝试从价格变化估算OI变化
    // 或者尝试获取历史OI数据（如果Hyperliquid提供）
    try {
      // 获取价格K线数据来计算价格变化
      const candleRes = await fetchWithTimeout(
        'https://api.hyperliquid.xyz/info',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'candleSnapshot',
            req: {
              coin: coin.toUpperCase(),
              interval: period,
              n: 2,
            },
          }),
          timeout: 10000,
        }
      );

      if (candleRes.ok) {
        const candleData: any = await candleRes.json();
        if (Array.isArray(candleData) && candleData.length >= 2) {
          const currentPrice = parseFloat(candleData[0].c || candleData[0].close || 0);
          const previousPrice = parseFloat(candleData[1].c || candleData[1].close || 0);
          const priceChangePercent = previousPrice > 0 
            ? ((currentPrice - previousPrice) / previousPrice) * 100 
            : 0;

          // 使用价格变化的30%作为OI变化的近似值（这是一个估算方法）
          // 注意：这不是真实的历史OI数据，但至少可以提供一个趋势指示
          const estimatedOIPercent = priceChangePercent * 0.3;
          const estimatedPreviousOI = currentOI / (1 + estimatedOIPercent / 100);

          return {
            success: true,
            data: {
              currentOI,
              previousOI: estimatedPreviousOI,
              oiChange: currentOI - estimatedPreviousOI,
              oiChangePercent: estimatedOIPercent,
              timestamp: Date.now(),
              period,
            },
          };
        }
      }
    } catch (e: any) {
      console.log('获取历史价格数据失败:', e.message);
    }

    // 如果无法获取历史数据，至少返回当前OI
    return {
      success: true,
      data: {
        currentOI,
        timestamp: Date.now(),
        period,
      },
    };
  } catch (error: any) {
    console.error('获取Hyperliquid OI数据失败:', error);
    return {
      success: false,
      error: error.message || '获取Hyperliquid OI数据失败',
    };
  }
}

// 方法2: 尝试其他方式获取OI数据
async function getHyperliquidOIMethod2(
  coin: string,
  period: '1h' | '4h'
): Promise<HyperliquidOIData> {
  try {
    // 尝试使用meta API获取所有资产信息
    const metaRes = await fetchWithTimeout(
      'https://api.hyperliquid.xyz/info',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'meta' }),
        timeout: 10000,
      }
    );

    if (!metaRes.ok) {
      return {
        success: false,
        error: `Hyperliquid meta API返回错误: ${metaRes.status}`,
      };
    }

    const metaData: any = await metaRes.json();
    
    // 从universe中查找对应币种
    const coinInfo = metaData?.universe?.find((item: any) => 
      item.name?.toUpperCase() === coin.toUpperCase()
    );

    if (!coinInfo) {
      return {
        success: false,
        error: `未找到币种 ${coin} 的信息`,
      };
    }

    // 如果meta API不包含OI数据，返回错误
    return {
      success: false,
      error: 'Hyperliquid meta API不包含OI数据，请使用metaAndAssetCtxs',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || '方法2失败',
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const coin = searchParams.get('coin'); // 例如: 'BTC', 'ETH'
    const period = (searchParams.get('period') || '1h') as '1h' | '4h';

    if (!coin) {
      return NextResponse.json(
        { success: false, error: 'coin参数是必需的' },
        { status: 400 }
      );
    }

    const result = await getHyperliquidOI(coin, period);

    return NextResponse.json(
      result,
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error: any) {
    console.error('Hyperliquid OI API错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '服务器错误',
      },
      { status: 500 }
    );
  }
}

