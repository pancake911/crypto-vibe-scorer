import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

// 使用Edge Runtime
export const runtime = 'edge';

// 获取币安历史数据（用于图表初始化）
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol'); // 例如: BTCUSDT
    const limit = parseInt(searchParams.get('limit') || '10'); // 获取最近N条数据

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol is required' }, { status: 400 });
    }

    const results: {
      fundingRate: Array<{ time: string; timestamp: number; value: number }>;
      price: Array<{ time: string; timestamp: number; value: number }>;
      longShortRatio: Array<{ time: string; timestamp: number; value: number }>;
    } = {
      fundingRate: [],
      price: [],
      longShortRatio: [],
    };

    // 1. 获取资金费率历史
    try {
      const fundingRateRes = await fetchWithTimeout(
        `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=${limit}`,
        {
          timeout: 3000, // 3秒超时
          next: { revalidate: 60 }, // 缓存1分钟
        }
      );

      if (fundingRateRes.ok) {
        const fundingRateData = await fundingRateRes.json();
        if (Array.isArray(fundingRateData)) {
          results.fundingRate = fundingRateData
            .slice(-limit)
            .map((item: any) => {
              const date = new Date(item.fundingTime);
              return {
                time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
                timestamp: item.fundingTime,
                value: parseFloat(item.fundingRate) * 100, // 转换为百分比
              };
            });
        }
      }
    } catch (e: any) {
      console.log('获取资金费率历史失败:', e.message);
    }

    // 2. 获取价格历史（使用K线数据）
    try {
      const klinesRes = await fetchWithTimeout(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=${limit}`,
        {
          timeout: 3000, // 3秒超时
          next: { revalidate: 60 },
        }
      );

      if (klinesRes.ok) {
        const klinesData = await klinesRes.json();
        if (Array.isArray(klinesData)) {
          results.price = klinesData
            .slice(-limit)
            .map((item: any) => {
              const date = new Date(item[0]);
              return {
                time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
                timestamp: item[0],
                value: parseFloat(item[4]), // 收盘价
              };
            });
        }
      }
    } catch (e: any) {
      console.log('获取价格历史失败:', e.message);
    }

    // 3. 获取多空持仓比历史（使用全球多空比数据）
    try {
      // 币安提供历史多空比数据，使用limit参数获取最近N条
      const ratioRes = await fetchWithTimeout(
        `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=${limit}`,
        {
          timeout: 3000, // 3秒超时
          next: { revalidate: 60 },
        }
      );

      if (ratioRes.ok) {
        const ratioDataArray = await ratioRes.json();
        if (Array.isArray(ratioDataArray)) {
          results.longShortRatio = ratioDataArray
            .slice(-limit)
            .map((item: any) => {
              const date = new Date(item.timestamp);
              return {
                time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
                timestamp: item.timestamp,
                value: parseFloat(item.longShortRatio),
              };
            });
        }
      }
    } catch (e: any) {
      console.log('获取多空比历史失败:', e.message);
    }

    // 历史数据可以缓存更长时间（2分钟）
    return NextResponse.json(
      {
        success: true,
        data: results,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
        },
      }
    );
  } catch (error: any) {
    console.error('Binance History API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取历史数据失败',
      },
      { status: 500 }
    );
  }
}

