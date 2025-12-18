import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

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

    // 2. 获取真实的OI数据 - 使用Binance的openInterest API
    let oiChangePercent = 0;
    let oiDataSuccess = false;
    let oiDataSource = 'unknown'; // 记录数据来源，用于调试

    // 方法1: 获取当前OI，然后通过对比历史K线数据估算变化
    // 这是最可靠的方法，因为openInterest API是公开的
    try {
      // 获取当前OI
      const currentOIRes = await fetchWithTimeout(
        `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`,
        {
          timeout: 10000, // 增加到10秒，确保在Vercel上有足够时间
          next: { revalidate: 60 },
        }
      );

      if (currentOIRes.ok) {
        const currentOIData: any = await currentOIRes.json();
        const currentOI = parseFloat(currentOIData.openInterest || 0);
        
        if (currentOI > 0) {
          // 尝试获取历史OI数据（通过openInterestHistory API）
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
                  oiDataSource = 'openInterestHistory';
                  console.log(`✅ 方法1成功（真实OI）: ${period}周期 OI变化 ${oiChangePercent.toFixed(2)}%`);
                }
              } else {
                console.log(`方法1: 历史OI数据格式错误`, historyData);
              }
            } else if (historyOIRes.status === 451) {
              console.log(`方法1: 历史OI API返回451（被限制），尝试其他方法`);
            } else {
              console.log(`方法1: 历史OI API返回错误 ${historyOIRes.status}`);
            }
          } catch (e2: any) {
            console.log(`方法1: 无法获取历史OI数据: ${e2.message}`);
          }
          
          // 如果历史数据不可用，尝试使用当前OI和价格变化来估算
          // 这是一个近似方法，但比完全猜测要好
          if (!oiDataSuccess && Math.abs(priceChangePercent) > 0.1) {
            // 如果价格有明显变化，假设OI也有相应变化（但幅度可能不同）
            // 这是一个经验值，可以根据实际情况调整
            oiChangePercent = priceChangePercent * 0.5; // 价格变化50%的幅度
            oiDataSuccess = true;
            oiDataSource = 'estimated_from_price';
            console.log(`⚠️ 方法1: 使用价格变化估算OI: ${period}周期 估算OI变化 ${oiChangePercent.toFixed(2)}%`);
          }
        } else {
          console.log(`方法1: 当前OI为0或无效`);
        }
      } else if (currentOIRes.status === 451) {
        console.log(`方法1: 当前OI API返回451（被限制），尝试其他方法`);
      } else {
        console.log(`方法1: 当前OI API返回错误 ${currentOIRes.status} ${currentOIRes.statusText}`);
      }
    } catch (e: any) {
      console.log(`方法1失败: ${e.message}`);
    }

    // 方法2: 如果方法1失败，尝试使用topLongShortAccountRatio作为替代
    // 这不是真正的OI，但可以反映市场情绪变化
    if (!oiDataSuccess) {
      try {
        const ratioRes = await fetchWithTimeout(
          `https://fapi.binance.com/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=2`,
          {
            timeout: 10000,
            next: { revalidate: 60 },
          }
        );

        if (ratioRes.ok) {
          const ratioData = await ratioRes.json();
          
          if (Array.isArray(ratioData) && ratioData.length >= 2) {
            const currentRatio = parseFloat(ratioData[0].longShortRatio || 0);
            const previousRatio = parseFloat(ratioData[1].longShortRatio || 0);
            
            if (previousRatio > 0 && currentRatio > 0) {
              // 使用多空账户比例的变化作为OI变化的近似值
              oiChangePercent = ((currentRatio - previousRatio) / previousRatio) * 100;
              oiDataSuccess = true;
              oiDataSource = 'topLongShortRatio';
              console.log(`⚠️ 方法2（近似OI）: ${period}周期 多空比变化 ${oiChangePercent.toFixed(2)}%`);
            }
          }
        } else if (ratioRes.status === 451) {
          console.log(`方法2: API返回451（被限制）`);
        }
      } catch (e: any) {
        console.log(`方法2失败: ${e.message}`);
      }
    }
    
    // 方法3: 如果前两种方法都失败，使用价格变化作为最后的fallback
    // 这不是真正的OI，但至少可以显示一些分析结果
    if (!oiDataSuccess) {
      console.log(`⚠️ 所有真实OI获取方法都失败，使用价格变化作为fallback`);
      // 使用价格变化的30%作为OI变化的近似值（这是一个非常粗略的估计）
      oiChangePercent = priceChangePercent * 0.3;
      oiDataSuccess = true;
      oiDataSource = 'price_fallback';
    }

    // 3. 分析趋势（即使数据都是0，也返回分析结果）
    const analysis = analyzeOITrend(priceChangePercent, oiChangePercent);

    return {
      period,
      ...analysis,
      // 添加数据来源标记，让前端知道这是真实数据还是估算数据
      dataSource: oiDataSource,
      isRealOI: oiDataSource === 'openInterestHistory',
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
