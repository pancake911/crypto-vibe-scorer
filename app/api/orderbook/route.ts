import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

// 使用Edge Runtime
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol') || 'BTCUSDT';
    const limit = parseInt(searchParams.get('limit') || '20');

    // 调用Binance Futures API获取深度数据（增加超时时间，盘口API可能较慢）
    const response = await fetchWithTimeout(
      `https://fapi.binance.com/fapi/v1/depth?symbol=${symbol}&limit=${limit}`,
      {
        timeout: 5000, // 增加到5秒超时
        next: { revalidate: 0 }, // 不缓存，实时数据
      }
    );

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    const data = await response.json();

    // 转换数据格式：将字符串数组转换为数字数组
    const bids = data.bids.map((bid: [string, string]) => [
      parseFloat(bid[0]), // 价格
      parseFloat(bid[1]), // 数量
    ]);

    const asks = data.asks.map((ask: [string, string]) => [
      parseFloat(ask[0]), // 价格
      parseFloat(ask[1]), // 数量
    ]);

    // 盘口数据实时性要求高，但可以短暂缓存（5秒）
    return NextResponse.json(
      {
        success: true,
        data: {
          symbol,
          bids,
          asks,
          lastUpdateId: data.lastUpdateId,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
        },
      }
    );
  } catch (error: any) {
    console.error('Order Book API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取盘口数据失败',
      },
      { status: 500 }
    );
  }
}

