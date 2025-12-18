import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

// 客户端通过服务器代理获取OI数据的端点
// 虽然服务器端直接调用可能被限制，但作为代理可能可以工作
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol'); // 例如: BTCUSDT
    const period = searchParams.get('period'); // 例如: 1h, 4h
    const type = searchParams.get('type'); // 'price' 或 'oi'
    
    if (!symbol || !period || !type) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: symbol, period, type' },
        { status: 400 }
      );
    }

    let url = '';
    if (type === 'price') {
      // 获取价格数据
      const interval = period === '1h' ? '1h' : '4h';
      url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=2`;
    } else if (type === 'oi') {
      // 获取OI历史数据
      url = `https://fapi.binance.com/futures/data/openInterestHistory?symbol=${symbol}&period=${period}&limit=2`;
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "price" or "oi"' },
        { status: 400 }
      );
    }

    // 尝试使用fetchWithTimeout（带User-Agent）
    try {
      const response = await fetchWithTimeout(url, {
        timeout: 10000,
        next: { revalidate: 60 },
      });

      if (!response.ok) {
        console.log(`❌ 代理获取${type}数据失败:`, {
          symbol,
          period,
          status: response.status,
          statusText: response.statusText,
        });
        
        // 如果返回451，尝试使用不同的方法
        if (response.status === 451 && type === 'oi') {
          console.log('尝试使用openInterest API作为备用...');
          // 尝试使用openInterest API获取当前OI，然后通过其他方式估算变化
          const currentOIRes = await fetchWithTimeout(
            `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`,
            {
              timeout: 10000,
              next: { revalidate: 60 },
            }
          );
          
          if (currentOIRes.ok) {
            const currentOIData: any = await currentOIRes.json();
            // 返回当前OI，让客户端知道至少获取到了当前值
            return NextResponse.json(
              { 
                success: true, 
                data: [{
                  openInterest: currentOIData.openInterest,
                  timestamp: Date.now(),
                }],
                note: 'Only current OI available, historical data blocked',
              },
              {
                headers: {
                  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
                },
              }
            );
          }
        }
        
        return NextResponse.json(
          { success: false, error: `API returned ${response.status}`, status: response.status },
          { status: response.status }
        );
      }

      const data = await response.json();
      
      console.log(`✅ 代理成功获取${type}数据:`, {
        symbol,
        period,
        dataLength: Array.isArray(data) ? data.length : 'not array',
      });
      
      return NextResponse.json(
        { success: true, data },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
            'Access-Control-Allow-Origin': '*', // 允许跨域
          },
        }
      );
    } catch (error: any) {
      console.error('Proxy fetch error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'Proxy request failed',
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Client proxy error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Proxy request failed',
      },
      { status: 500 }
    );
  }
}

