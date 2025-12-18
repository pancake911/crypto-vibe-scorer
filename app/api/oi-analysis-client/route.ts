import { NextRequest, NextResponse } from 'next/server';

// 客户端直接调用Binance API的代理端点
// 这个端点只做简单的转发，不进行复杂处理，避免被限制
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url'); // Binance API的完整URL
    
    if (!url || !url.startsWith('https://fapi.binance.com/')) {
      return NextResponse.json(
        { success: false, error: 'Invalid URL' },
        { status: 400 }
      );
    }

    // 添加User-Agent等请求头
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `API returned ${response.status}`, status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
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

