import { NextRequest, NextResponse } from 'next/server';

// 简化版Hyperliquid API测试（不使用fetchWithTimeout，直接测试）
export async function GET(request: NextRequest) {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {},
    };

    // 测试1: 最简单的POST请求
    try {
      console.log('测试1: 获取Hyperliquid元数据...');
      const metaRes = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'meta' }),
      });

      if (metaRes.ok) {
        const metaData = await metaRes.json();
        results.tests.meta = {
          success: true,
          status: metaRes.status,
          hasUniverse: !!metaData.universe,
          universeLength: metaData.universe?.length || 0,
        };
        console.log('✅ 测试1成功');
      } else {
        results.tests.meta = {
          success: false,
          status: metaRes.status,
          statusText: metaRes.statusText,
        };
        console.log(`❌ 测试1失败: ${metaRes.status}`);
      }
    } catch (e: any) {
      results.tests.meta = {
        success: false,
        error: e.message,
      };
      console.log(`❌ 测试1异常: ${e.message}`);
    }

    // 测试2: 获取资产上下文（包含OI数据）
    try {
      console.log('测试2: 获取资产上下文...');
      const assetRes = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      });

      if (assetRes.ok) {
        const assetData = await assetRes.json();
        const btcCtx = assetData?.assetCtxs?.find((ctx: any) => ctx.name === 'BTC');
        const ethCtx = assetData?.assetCtxs?.find((ctx: any) => ctx.name === 'ETH');
        
        results.tests.assetCtxs = {
          success: true,
          status: assetRes.status,
          totalAssets: assetData?.assetCtxs?.length || 0,
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
        console.log('✅ 测试2成功');
      } else {
        results.tests.assetCtxs = {
          success: false,
          status: assetRes.status,
          statusText: assetRes.statusText,
        };
        console.log(`❌ 测试2失败: ${assetRes.status}`);
      }
    } catch (e: any) {
      results.tests.assetCtxs = {
        success: false,
        error: e.message,
      };
      console.log(`❌ 测试2异常: ${e.message}`);
    }

    // 汇总
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

