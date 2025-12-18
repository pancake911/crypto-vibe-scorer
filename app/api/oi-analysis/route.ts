import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

// OI趋势分析结果接口
interface OIAnalysisResult {
  period: '1h' | '4h';
  priceChange: number; // 价格变化百分比
  oiChange: number; // OI变化百分比
  score: number; // 得分
  label: string; // 标签
  description: string; // 描述
  status: 'healthy' | 'danger' | 'opportunity' | 'accumulation' | 'crash';
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
    // 1. 获取价格历史数据（K线）- 这个API是可靠的
    const interval = period === '1h' ? '1h' : '4h';
    const klinesRes = await fetchWithTimeout(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=2`,
      {
        timeout: 3000, // 3秒超时
        next: { revalidate: 60 },
      }
    );

    if (!klinesRes.ok) {
      console.error(`获取价格数据失败: ${klinesRes.status}`);
      return null;
    }

    const klinesData = await klinesRes.json();
    if (!Array.isArray(klinesData) || klinesData.length < 2) {
      console.error('价格数据不足');
      return null;
    }

    const currentPrice = parseFloat(klinesData[0][4]); // 收盘价
    const previousPrice = parseFloat(klinesData[1][4]); // 上一个收盘价
    const priceChangePercent = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;

    // 2. 获取OI数据 - 尝试多个API端点
    let oiChangePercent = 0;
    let oiDataSuccess = false;

    // 方法1: 尝试使用openInterestStatistics（如果可用）
    try {
      const oiRes = await fetchWithTimeout(
        `https://fapi.binance.com/futures/data/openInterestStatistics?symbol=${symbol}&period=${period}&limit=2`,
        {
          timeout: 3000, // 3秒超时
          next: { revalidate: 60 },
        }
      );

      if (oiRes.ok) {
        const oiData: any = await oiRes.json();
        
        // 检查是否是数组（数组不会有code属性，所以不需要检查code）
        if (Array.isArray(oiData) && oiData.length >= 2) {
          const currentOI = parseFloat(oiData[0].sumOpenInterest || oiData[0].openInterest || 0);
          const previousOI = parseFloat(oiData[1].sumOpenInterest || oiData[1].openInterest || 0);
          
          if (previousOI > 0 && currentOI > 0) {
            oiChangePercent = ((currentOI - previousOI) / previousOI) * 100;
            oiDataSuccess = true;
          }
        }
      }
    } catch (e: any) {
      console.log(`方法1失败: ${e.message}`);
    }

    // 方法2: 如果方法1失败，尝试使用topLongShortAccountRatio作为替代指标
    // 注意：这不是真正的OI，但可以反映市场情绪
    if (!oiDataSuccess) {
      try {
        const ratioRes = await fetchWithTimeout(
          `https://fapi.binance.com/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=2`,
          {
            timeout: 3000, // 3秒超时
            next: { revalidate: 60 },
          }
        );

        if (ratioRes.ok) {
          const ratioData = await ratioRes.json();
          
          if (Array.isArray(ratioData) && ratioData.length >= 2) {
            // 使用多空账户比例的变化作为OI变化的近似值
            const currentRatio = parseFloat(ratioData[0].longShortRatio || 0);
            const previousRatio = parseFloat(ratioData[1].longShortRatio || 0);
            
            if (previousRatio > 0) {
              // 将比例变化转换为百分比（这是一个近似值）
              oiChangePercent = ((currentRatio - previousRatio) / previousRatio) * 100;
              oiDataSuccess = true;
            }
          }
        }
      } catch (e: any) {
        console.log(`方法2失败: ${e.message}`);
      }
    }

    // 如果两种方法都失败，返回null
    if (!oiDataSuccess) {
      console.warn(`无法获取${period}周期的OI数据`);
      return null;
    }

    // 3. 分析趋势
    const analysis = analyzeOITrend(priceChangePercent, oiChangePercent);

    return {
      period,
      ...analysis,
    };
  } catch (error: any) {
    console.error(`获取${period} OI分析失败:`, error.message);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol'); // 例如: BTCUSDT

    if (!symbol) {
      return NextResponse.json({ success: false, error: 'Symbol is required' }, { status: 400 });
    }

    // 并行获取1小时和4小时的分析
    const [analysis1h, analysis4h] = await Promise.all([
      getOIAnalysis(symbol, '1h'),
      getOIAnalysis(symbol, '4h'),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        symbol,
        '1h': analysis1h,
        '4h': analysis4h,
      },
    });
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
