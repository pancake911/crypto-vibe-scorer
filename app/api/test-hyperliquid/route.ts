import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

// 测试Hyperliquid API在Vercel上的访问情况
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const testType = searchParams.get('type') || 'meta'; // 测试类型

    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {},
    };

    // 测试1: 获取元数据（基础测试）
    try {
      console.log('测试1: 获取Hyperliquid元数据...');
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

      if (metaRes.ok) {
        const metaData = await metaRes.json();
        results.tests.meta = {
          success: true,
          status: metaRes.status,
          hasUniverse: !!metaData.universe,
          universeLength: metaData.universe?.length || 0,
          sampleCoin: metaData.universe?.[0]?.name || null,
        };
        console.log('✅ 测试1成功: 元数据获取正常');
      } else {
        results.tests.meta = {
          success: false,
          status: metaRes.status,
          statusText: metaRes.statusText,
        };
        console.log(`❌ 测试1失败: ${metaRes.status} ${metaRes.statusText}`);
      }
    } catch (e: any) {
      results.tests.meta = {
        success: false,
        error: e.message,
      };
      console.log(`❌ 测试1异常: ${e.message}`);
    }

    // 测试2: 获取BTC的OI数据（尝试不同的端点）
    try {
      console.log('测试2: 获取BTC OI数据...');
      
      // 方法1: 尝试使用metaAndAssetCtxs获取资产上下文（可能包含OI）
      const assetCtxRes = await fetchWithTimeout(
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

      if (assetCtxRes.ok) {
        const assetData = await assetCtxRes.json();
        // 查找BTC的数据
        const btcData = assetData?.assetCtxs?.find((ctx: any) => ctx.name === 'BTC');
        results.tests.assetCtxs = {
          success: true,
          status: assetCtxRes.status,
          hasAssetCtxs: !!assetData.assetCtxs,
          btcFound: !!btcData,
          btcData: btcData ? {
            name: btcData.name,
            hasOpenInterest: btcData.openInterest !== undefined,
            openInterest: btcData.openInterest,
          } : null,
        };
        console.log('✅ 测试2成功: 资产上下文获取正常', btcData ? '找到BTC数据' : '未找到BTC数据');
      } else {
        results.tests.assetCtxs = {
          success: false,
          status: assetCtxRes.status,
          statusText: assetCtxRes.statusText,
        };
        console.log(`❌ 测试2失败: ${assetCtxRes.status} ${assetCtxRes.statusText}`);
      }
    } catch (e: any) {
      results.tests.assetCtxs = {
        success: false,
        error: e.message,
      };
      console.log(`❌ 测试2异常: ${e.message}`);
    }

    // 测试3: 尝试获取价格数据（验证API基本可用性）
    try {
      console.log('测试3: 获取BTC价格数据...');
      const priceRes = await fetchWithTimeout(
        'https://api.hyperliquid.xyz/info',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'candleSnapshot',
            req: {
              coin: 'BTC',
              interval: '1h',
              n: 2,
            },
          }),
          timeout: 10000,
        }
      );

      if (priceRes.ok) {
        const priceData = await priceRes.json();
        results.tests.price = {
          success: true,
          status: priceRes.status,
          hasData: !!priceData,
          dataLength: Array.isArray(priceData) ? priceData.length : 'not array',
        };
        console.log('✅ 测试3成功: 价格数据获取正常');
      } else {
        results.tests.price = {
          success: false,
          status: priceRes.status,
          statusText: priceRes.statusText,
        };
        console.log(`❌ 测试3失败: ${priceRes.status} ${priceRes.statusText}`);
      }
    } catch (e: any) {
      results.tests.price = {
        success: false,
        error: e.message,
      };
      console.log(`❌ 测试3异常: ${e.message}`);
    }

    // 测试4: 尝试获取所有资产的上下文（可能包含OI）
    try {
      console.log('测试4: 获取所有资产上下文...');
      const allAssetsRes = await fetchWithTimeout(
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

      if (allAssetsRes.ok) {
        const allAssetsData = await allAssetsRes.json();
        const btcCtx = allAssetsData?.assetCtxs?.find((ctx: any) => ctx.name === 'BTC');
        const ethCtx = allAssetsData?.assetCtxs?.find((ctx: any) => ctx.name === 'ETH');
        
        results.tests.allAssets = {
          success: true,
          status: allAssetsRes.status,
          totalAssets: allAssetsData?.assetCtxs?.length || 0,
          btc: btcCtx ? {
            openInterest: btcCtx.openInterest,
            funding: btcCtx.funding,
            markPx: btcCtx.markPx,
          } : null,
          eth: ethCtx ? {
            openInterest: ethCtx.openInterest,
            funding: ethCtx.funding,
            markPx: ethCtx.markPx,
          } : null,
        };
        console.log('✅ 测试4成功: 所有资产上下文获取正常');
      } else {
        results.tests.allAssets = {
          success: false,
          status: allAssetsRes.status,
          statusText: allAssetsRes.statusText,
        };
        console.log(`❌ 测试4失败: ${allAssetsRes.status} ${allAssetsRes.statusText}`);
      }
    } catch (e: any) {
      results.tests.allAssets = {
        success: false,
        error: e.message,
      };
      console.log(`❌ 测试4异常: ${e.message}`);
    }

    // 汇总结果
    const allTestsPassed = Object.values(results.tests).every((test: any) => test.success);
    results.summary = {
      allTestsPassed,
      totalTests: Object.keys(results.tests).length,
      passedTests: Object.values(results.tests).filter((test: any) => test.success).length,
    };

    return NextResponse.json(
      {
        success: true,
        message: allTestsPassed 
          ? '✅ 所有测试通过！Hyperliquid API在Vercel上可以正常访问' 
          : '⚠️ 部分测试失败，请查看详细信息',
        results,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error: any) {
    console.error('Hyperliquid API测试失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '测试失败',
      },
      { status: 500 }
    );
  }
}

