import { NextRequest, NextResponse } from 'next/server';

// 调试Hyperliquid API响应格式
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const coin = searchParams.get('coin') || 'BTC';

    const results: any = {
      timestamp: new Date().toISOString(),
      coin,
      tests: {},
    };

    // 测试1: metaAndAssetCtxs
    try {
      const res1 = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      });

      if (res1.ok) {
        const data1: any = await res1.json();
        results.tests.metaAndAssetCtxs = {
          success: true,
          status: res1.status,
          responseKeys: Object.keys(data1),
          assetCtxsType: Array.isArray(data1?.assetCtxs) ? 'array' : typeof data1?.assetCtxs,
          assetCtxsLength: Array.isArray(data1?.assetCtxs) ? data1.assetCtxs.length : 'not array',
          fullResponse: data1, // 返回完整响应以便调试
        };
      } else {
        results.tests.metaAndAssetCtxs = {
          success: false,
          status: res1.status,
          statusText: res1.statusText,
        };
      }
    } catch (e: any) {
      results.tests.metaAndAssetCtxs = {
        success: false,
        error: e.message,
      };
    }

    // 测试2: 尝试使用allMids获取所有中间价（可能包含OI）
    try {
      const res2 = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'allMids' }),
      });

      if (res2.ok) {
        const data2: any = await res2.json();
        results.tests.allMids = {
          success: true,
          status: res2.status,
          responseKeys: Object.keys(data2),
          fullResponse: data2,
        };
      } else {
        results.tests.allMids = {
          success: false,
          status: res2.status,
          statusText: res2.statusText,
        };
      }
    } catch (e: any) {
      results.tests.allMids = {
        success: false,
        error: e.message,
      };
    }

    // 测试3: 尝试使用l2Book获取订单簿（可能包含OI信息）
    try {
      const res3 = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'l2Book',
          coin: coin.toUpperCase(),
        }),
      });

      if (res3.ok) {
        const data3: any = await res3.json();
        results.tests.l2Book = {
          success: true,
          status: res3.status,
          responseKeys: Object.keys(data3),
          fullResponse: data3,
        };
      } else {
        results.tests.l2Book = {
          success: false,
          status: res3.status,
          statusText: res3.statusText,
        };
      }
    } catch (e: any) {
      results.tests.l2Book = {
        success: false,
        error: e.message,
      };
    }

    // 测试4: 尝试使用meta获取元数据
    try {
      const res4 = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'meta' }),
      });

      if (res4.ok) {
        const data4: any = await res4.json();
        const coinInfo = data4?.universe?.find((item: any) => 
          item.name?.toUpperCase() === coin.toUpperCase()
        );
        results.tests.meta = {
          success: true,
          status: res4.status,
          hasUniverse: !!data4?.universe,
          universeLength: data4?.universe?.length || 0,
          coinFound: !!coinInfo,
          coinInfo: coinInfo,
        };
      } else {
        results.tests.meta = {
          success: false,
          status: res4.status,
          statusText: res4.statusText,
        };
      }
    } catch (e: any) {
      results.tests.meta = {
        success: false,
        error: e.message,
      };
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Hyperliquid API调试信息',
        results,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    console.error('调试失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '调试失败',
      },
      { status: 500 }
    );
  }
}

