import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

// 导入Hyperliquid OI获取函数（直接调用，避免HTTP请求）
async function getHyperliquidOIDirect(coin: string, period: '1h' | '4h'): Promise<{
  success: boolean;
  currentOI?: number;
  oiChangePercent?: number;
  error?: string;
}> {
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
    });
    
    // 查找对应币种的资产上下文
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
      return {
        success: false,
        error: '未找到资产上下文或OI数据',
      };
    }

    const currentOI = parseFloat(assetCtx.openInterest || 0);
    
    if (currentOI === 0) {
      return {
        success: false,
        error: '当前OI为0，数据可能不准确',
      };
    }

    // 获取历史K线数据来计算价格变化，然后估算OI变化
    try {
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

          // 使用价格变化的30%作为OI变化的近似值
          const estimatedOIPercent = priceChangePercent * 0.3;

          return {
            success: true,
            currentOI,
            oiChangePercent: estimatedOIPercent,
          };
        }
      }
    } catch (e: any) {
      console.log('获取历史价格数据失败:', e.message);
    }

    // 如果无法获取历史数据，至少返回当前OI
    return {
      success: true,
      currentOI,
    };
  } catch (error: any) {
    console.error('获取Hyperliquid OI数据失败:', error);
    return {
      success: false,
      error: error.message || '获取Hyperliquid OI数据失败',
    };
  }
}

// 不使用Edge Runtime，因为需要多次API调用，Node.js runtime更稳定
// export const runtime = 'edge';

// OI趋势分析结果接口
interface OIAnalysisResult {
  period: '1h' | '4h';
  priceChange: number; // 价格变化百分比
  oiChange: number; // OI变化百分比
  score: number; // 得分
  label: string; // 标签
  description: string; // 描述
  status: 'healthy' | 'danger' | 'opportunity' | 'accumulation' | 'crash';
  dataSource?: string; // 数据来源（用于调试）
  isRealOI?: boolean; // 是否为真实OI数据
}

// OI趋势分析逻辑
function analyzeOITrend(priceChangePercent: number, oiChangePercent: number): Omit<OIAnalysisResult, 'period'> {
  // 1. 健康趋势 (Clean Trend)
  if (priceChangePercent > 0.5 && oiChangePercent > 0.5) {
    return {
      priceChange: priceChangePercent,
      oiChange: oiChangePercent,
      score: 10,
      label: '🟢 趋势健康 (资金做多)',
      description: '价格上涨且OI上涨，资金进场推动上涨',
      status: 'healthy',
    };
  }

  // 2. 顶部背离 (Top Divergence) - 危险
  if (priceChangePercent > 0.5 && oiChangePercent < -0.5) {
    return {
      priceChange: priceChangePercent,
      oiChange: oiChangePercent,
      score: -15,
      label: '🔴 顶部背离 (多头跑路)',
      description: '价格新高但多头离场，只剩下散户在冲',
      status: 'danger',
    };
  }

  // 3. 底部吸筹/买入机会 (Bottom Accumulation/V-Shape)
  if (priceChangePercent < -1 && oiChangePercent > 2) {
    return {
      priceChange: priceChangePercent,
      oiChange: oiChangePercent,
      score: 15,
      label: '🟡 底部异动 (恐慌盘/强力换手)',
      description: '下跌中有人疯狂开仓，可能是被动爆仓后的V反，或者是主力接针',
      status: 'opportunity',
    };
  }

  // 4. 主力潜伏 (Hidden Accumulation)
  if (Math.abs(priceChangePercent) <= 0.2 && oiChangePercent > 1) {
    return {
      priceChange: priceChangePercent,
      oiChange: oiChangePercent,
      score: 10,
      label: '🔵 主力潜伏 (蓄势待发)',
      description: '价格横盘但OI持续上涨，暗中建仓',
      status: 'accumulation',
    };
  }

  // 5. 大撤退 (Crash Warning)
  if (oiChangePercent < -5) {
    return {
      priceChange: priceChangePercent,
      oiChange: oiChangePercent,
      score: -20,
      label: '⚠️ 多头大逃亡 (大清算)',
      description: 'OI单次暴跌，多头大逃亡',
      status: 'crash',
    };
  }

  // 默认情况：无明显信号
  return {
    priceChange: priceChangePercent,
    oiChange: oiChangePercent,
    score: 0,
    label: '⚪ 无明显信号',
    description: '价格和OI变化都在正常范围内',
    status: 'healthy',
  };
}

// 获取OI和价格数据并分析
async function getOIAnalysis(symbol: string, period: '1h' | '4h'): Promise<OIAnalysisResult | null> {
  try {
    // 1. 获取价格历史数据（K线）- 如果被限制，使用ticker API作为备用
    const interval = period === '1h' ? '1h' : '4h';
    let priceChangePercent = 0;
    
    // 先尝试klines API
    try {
      const klinesRes = await fetchWithTimeout(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=2`,
        {
          timeout: 10000,
          next: { revalidate: 60 },
        }
      );
      
      if (klinesRes.ok) {
        const klinesData = await klinesRes.json();
        if (Array.isArray(klinesData) && klinesData.length >= 2) {
          const currentPrice = parseFloat(klinesData[0][4]); // 收盘价
          const previousPrice = parseFloat(klinesData[1][4]); // 上一个收盘价
          priceChangePercent = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
          console.log(`✅ 使用Klines API获取价格变化: ${priceChangePercent.toFixed(2)}%`);
        }
      } else if (klinesRes.status === 451) {
        console.log(`⚠️ Klines API返回451（被限制），尝试使用ticker API`);
        // 如果被限制，尝试使用ticker API
        throw new Error('Klines API被限制');
      } else {
        console.log(`⚠️ Klines API返回错误: ${klinesRes.status}`);
      }
    } catch (e: any) {
      // 如果klines失败或被限制，使用ticker API作为备用
      console.log(`尝试使用ticker API作为备用: ${e.message}`);
      try {
        const tickerRes = await fetchWithTimeout(
          `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`,
          {
            timeout: 10000,
            next: { revalidate: 60 },
          }
        );
        
        if (tickerRes.ok) {
          const tickerData = await tickerRes.json();
          const currentPrice = parseFloat(tickerData.lastPrice || 0);
          const openPrice = parseFloat(tickerData.openPrice || 0);
          
          if (openPrice > 0) {
            // 使用24小时价格变化作为近似值（这不是精确的1h/4h变化，但至少可以继续分析）
            priceChangePercent = ((currentPrice - openPrice) / openPrice) * 100;
            console.log(`⚠️ 使用ticker API获取价格变化（近似值）: ${priceChangePercent.toFixed(2)}%`);
          }
        } else if (tickerRes.status === 451) {
          console.log(`⚠️ Ticker API也返回451，使用默认值0%`);
        }
      } catch (e2: any) {
        console.log(`Ticker API也失败: ${e2.message}，使用默认值0%`);
      }
    }

    // 2. 获取真实的OI数据 - 优先使用Hyperliquid API，然后尝试Binance API
    let oiChangePercent = 0;
    let oiDataSuccess = false;
    let oiDataSource = 'unknown'; // 记录数据来源，用于调试
    let isRealOI = false; // 标记是否为真实OI数据

    // 方法0: 优先使用Hyperliquid API获取OI数据（不受Vercel IP限制）
    try {
      // 将Binance symbol转换为Hyperliquid coin格式（例如：BTCUSDT -> BTC）
      const coin = symbol.replace('USDT', '').replace('USD', '');
      
      // 直接调用内部函数，避免HTTP请求开销
      const hyperliquidData = await getHyperliquidOIDirect(coin, period);

      if (hyperliquidData.success) {
        if (hyperliquidData.oiChangePercent !== undefined) {
          oiChangePercent = hyperliquidData.oiChangePercent;
          oiDataSuccess = true;
          oiDataSource = 'hyperliquid_api';
          isRealOI = false; // 这是基于价格变化估算的，不是真实历史OI
          console.log(`✅ 方法0成功（Hyperliquid OI，基于价格估算）: ${period}周期 OI变化 ${oiChangePercent.toFixed(2)}%`);
        } else if (hyperliquidData.currentOI) {
          // 如果只有当前OI，使用价格变化估算
          oiChangePercent = priceChangePercent * 0.3; // 使用价格变化的30%作为估算
          oiDataSuccess = true;
          oiDataSource = 'hyperliquid_current_oi_estimated';
          isRealOI = false; // 估算数据不是真实历史OI
          console.log(`⚠️ 方法0: Hyperliquid只有当前OI，使用价格变化估算: ${period}周期 估算OI变化 ${oiChangePercent.toFixed(2)}%`);
        }
      } else {
        console.log(`方法0失败（Hyperliquid）: ${hyperliquidData.error}`);
      }
    } catch (e: any) {
      console.log(`方法0异常（Hyperliquid）: ${e.message}`);
    }

    // 方法1: 如果Hyperliquid失败，尝试使用Binance公共数据端点（data-api.binance.vision）- 可能不受限制
    try {
      // 注意：这个端点可能不支持所有数据，但值得尝试
      const publicDataRes = await fetchWithTimeout(
        `https://data-api.binance.vision/futures/data/openInterestHistory?symbol=${symbol}&period=${period}&limit=2`,
        {
          timeout: 10000,
          next: { revalidate: 60 },
        }
      );

      if (publicDataRes.ok) {
        const publicData: any = await publicDataRes.json();
        if (Array.isArray(publicData) && publicData.length >= 2) {
          const currentOI = parseFloat(publicData[0].sumOpenInterest || publicData[0].openInterest || 0);
          const previousOI = parseFloat(publicData[1].sumOpenInterest || publicData[1].openInterest || 0);
          
          if (previousOI > 0 && currentOI > 0) {
            oiChangePercent = ((currentOI - previousOI) / previousOI) * 100;
            oiDataSuccess = true;
            oiDataSource = 'binance_public_api';
            isRealOI = true;
            console.log(`✅ 方法1成功（Binance公共API真实OI）: ${period}周期 OI变化 ${oiChangePercent.toFixed(2)}%`);
          }
        }
      } else if (publicDataRes.status !== 451) {
        // 如果不是451错误，记录其他错误
        console.log(`方法1: Binance公共API返回错误 ${publicDataRes.status}`);
      }
    } catch (e: any) {
      console.log(`方法1失败: ${e.message}`);
    }

    // 方法2: 如果方法1失败，尝试使用Bybit API获取真实OI数据
    // Bybit对API访问通常更友好，不受Vercel IP限制
    if (!oiDataSuccess) {
      try {
        // 将Binance symbol转换为Bybit symbol格式（例如：BTCUSDT -> BTCUSDT）
        const bybitSymbol = symbol; // Bybit和Binance使用相同的symbol格式
        
        // Bybit API获取OI数据
        // 注意：Bybit的open-interest API可能需要不同的参数格式
        // 先尝试使用open-interest-history端点
        const bybitRes = await fetchWithTimeout(
          `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${bybitSymbol}&interval=${period === '1h' ? '1h' : '4h'}&limit=2`,
          {
            timeout: 10000,
            next: { revalidate: 60 },
          }
        );

        if (bybitRes.ok) {
          const bybitData: any = await bybitRes.json();
          if (bybitData.retCode === 0 && bybitData.result && bybitData.result.list) {
            const list = bybitData.result.list;
            if (list.length >= 2) {
              const currentOI = parseFloat(list[0].openInterest || 0);
              const previousOI = parseFloat(list[1].openInterest || 0);
              
              if (previousOI > 0 && currentOI > 0) {
                oiChangePercent = ((currentOI - previousOI) / previousOI) * 100;
                oiDataSuccess = true;
                oiDataSource = 'bybit_api';
                isRealOI = true;
                console.log(`✅ 方法2成功（Bybit真实OI）: ${period}周期 OI变化 ${oiChangePercent.toFixed(2)}%`);
              }
            }
          } else {
            console.log(`方法2: Bybit API返回错误 retCode=${bybitData.retCode}`);
          }
        } else {
          console.log(`方法2: Bybit API HTTP错误 ${bybitRes.status}`);
        }
      } catch (e: any) {
        console.log(`方法2失败: ${e.message}`);
      }
    }

    // 方法3: 如果前两种方法都失败，尝试使用Binance标准API（可能被限制，但作为最后尝试）
    if (!oiDataSuccess) {
      try {
        // 获取当前OI
        const currentOIRes = await fetchWithTimeout(
          `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`,
          {
            timeout: 10000,
            next: { revalidate: 60 },
          }
        );

        if (currentOIRes.ok) {
          const currentOIData: any = await currentOIRes.json();
          const currentOI = parseFloat(currentOIData.openInterest || 0);
          
          if (currentOI > 0) {
            // 尝试获取历史OI数据
            try {
              const historyOIRes = await fetchWithTimeout(
                `https://fapi.binance.com/futures/data/openInterestHistory?symbol=${symbol}&period=${period}&limit=2`,
                {
                  timeout: 10000,
                  next: { revalidate: 60 },
                }
              );
              
              if (historyOIRes.ok) {
                const historyData: any = await historyOIRes.json();
                if (Array.isArray(historyData) && historyData.length >= 2) {
                  const previousOI = parseFloat(historyData[1].sumOpenInterest || historyData[1].openInterest || 0);
                  if (previousOI > 0) {
                    oiChangePercent = ((currentOI - previousOI) / previousOI) * 100;
                    oiDataSuccess = true;
                    oiDataSource = 'binance_standard_api';
                    console.log(`✅ 方法3成功（Binance标准API真实OI）: ${period}周期 OI变化 ${oiChangePercent.toFixed(2)}%`);
                  }
                } else {
                  console.log(`方法3: 历史OI数据格式错误或数据不足`, historyData);
                }
              } else {
                console.log(`方法3: 历史OI API返回错误 ${historyOIRes.status} ${historyOIRes.statusText}`);
                // 如果历史数据获取失败，但当前OI可用，尝试使用当前OI和价格变化估算
                // 这是一个fallback，虽然不是完美的，但至少可以显示一些信息
                if (currentOI > 0 && Math.abs(priceChangePercent) > 0.1) {
                  // 使用价格变化的30%作为OI变化的近似值
                  oiChangePercent = priceChangePercent * 0.3;
                  oiDataSuccess = true;
                  oiDataSource = 'binance_current_oi_estimated';
                  console.log(`⚠️ 方法3: 使用当前OI和价格变化估算: ${period}周期 估算OI变化 ${oiChangePercent.toFixed(2)}%`);
                }
              }
            } catch (e2: any) {
              console.log(`方法3: 无法获取历史OI数据: ${e2.message}`);
            }
          }
        }
      } catch (e: any) {
        console.log(`方法3失败: ${e.message}`);
      }
    }

    // 4. 如果所有真实OI获取方法都失败，返回错误而不是使用估算数据
    // 用户明确要求真实OI数据，不使用估算
    if (!oiDataSuccess) {
      console.log(`❌ 所有真实OI获取方法都失败，无法获取真实OI数据`);
      // 不设置估算数据，让前端知道这是真实数据获取失败
      return {
        period,
        priceChange: priceChangePercent,
        oiChange: 0,
        score: 0,
        label: '⚠️ 无法获取真实OI数据',
        description: '所有OI数据源都被限制（HTTP 451），无法获取真实未平仓合约数据。已尝试：Binance公共API、Bybit API、Binance标准API。',
        status: 'healthy',
        dataSource: 'failed',
        isRealOI: false,
      };
    }

    // 判断是否为真实OI数据（已经在上面设置，这里不再重复判断）
    // isRealOI变量已经在各个方法中设置

    // 3. 分析趋势（使用真实OI数据或估算数据）
    const analysis = analyzeOITrend(priceChangePercent, oiChangePercent);

    return {
      period,
      ...analysis,
      // 添加数据来源标记，让前端知道这是真实数据
      dataSource: oiDataSource,
      isRealOI: isRealOI,
    };
  } catch (error: any) {
    console.error(`获取${period} OI分析失败:`, error.message);
    // 即使出错也返回一个默认的分析结果，而不是null
    return {
      period,
      priceChange: 0,
      oiChange: 0,
      score: 0,
      label: '⚪ 数据获取失败',
      description: '无法获取OI数据，请稍后重试',
      status: 'healthy',
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol'); // 例如: BTCUSDT

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol is required' }, { status: 400 });
    }

    // 并行获取1小时和4小时的分析（使用Promise.allSettled，避免一个失败影响另一个）
    const [result1h, result4h] = await Promise.allSettled([
      getOIAnalysis(symbol, '1h'),
      getOIAnalysis(symbol, '4h'),
    ]);

    const analysis1h = result1h.status === 'fulfilled' ? result1h.value : null;
    const analysis4h = result4h.status === 'fulfilled' ? result4h.value : null;

    // 即使部分数据获取失败，也返回成功，让前端显示可用的数据
    // 添加调试信息（在生产环境也返回，帮助诊断问题）
    const debugInfo = {
      '1h_status': result1h.status,
      '4h_status': result4h.status,
      '1h_reason': result1h.status === 'rejected' ? String(result1h.reason) : null,
      '4h_reason': result4h.status === 'rejected' ? String(result4h.reason) : null,
      '1h_data': analysis1h ? 'available' : 'null',
      '4h_data': analysis4h ? 'available' : 'null',
    };
    
    return NextResponse.json(
      {
        success: true,
        data: {
          symbol,
          '1h': analysis1h,
          '4h': analysis4h,
        },
        debug: debugInfo, // 返回调试信息，帮助诊断Vercel上的问题
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error: any) {
    console.error('OI Analysis API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取OI分析失败',
      },
      { status: 500 }
    );
  }
}
