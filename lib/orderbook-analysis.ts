/**
 * 盘口分析函数
 * @param bids 买单深度数据 [[价格, 数量], ...]
 * @param asks 卖单深度数据 [[价格, 数量], ...]
 * @returns 分析结果数组
 */

export interface OrderBookAnalysisResult {
  type: 'warning' | 'info' | 'danger' | 'success';
  icon: string;
  title: string;
  description: string;
  price?: number; // 相关价格
  volume?: number; // 挂单量
  avgVolume?: number; // 平均挂单量
  totalVolume?: number; // 总挂单量
  severity: 'low' | 'medium' | 'high';
  timestamp: number; // 时间戳
}

export interface OrderBookAnalysisConfig {
  minVolumeForWall?: number; // 假护盘/假压盘的最小挂单量阈值
  minAvgVolumeForLadder?: number; // 密集网格的最小平均挂单量阈值
  maxTotalVolumeForThin?: number; // 盘口真空的最大总挂单量阈值
}

export function analyzeOrderBook(
  bids: number[][],
  asks: number[][],
  config: OrderBookAnalysisConfig = {}
): OrderBookAnalysisResult[] {
  const {
    minVolumeForWall = 100, // 默认100
    minAvgVolumeForLadder = 500, // 默认500
    maxTotalVolumeForThin = 50, // 默认50
  } = config;
  const results: OrderBookAnalysisResult[] = [];

  // 分析前10档数据
  const topBids = bids.slice(0, 10);
  const topAsks = asks.slice(0, 10);

  // 1. 识别"假护盘/假压盘" (Spoofing/Wall)
  // 检查买单（Bids）
  if (topBids.length >= 3) {
    const bidVolumes = topBids.map((bid) => bid[1]);
    const avgBidVolume = bidVolumes.reduce((a, b) => a + b, 0) / bidVolumes.length;
    
    // 找出异常大的单子（超过平均值5倍）
    for (let i = 0; i < topBids.length; i++) {
      const volume = bidVolumes[i];
      if (volume > avgBidVolume * 5 && volume > minVolumeForWall) {
        // 确保不是所有单子都很大（避免误判）
        const otherVolumes = bidVolumes.filter((_, idx) => idx !== i);
        const otherAvg = otherVolumes.reduce((a, b) => a + b, 0) / otherVolumes.length;
        
        if (volume > otherAvg * 5) {
          results.push({
            type: 'warning',
            icon: '🟡',
            title: '假护盘检测',
            description: `检测到下方有巨额买单墙 (可能是假护盘)`,
            price: topBids[i][0],
            volume: volume,
            avgVolume: otherAvg,
            severity: 'medium',
            timestamp: Date.now(),
          });
          break; // 只报告第一个异常大单
        }
      }
    }
  }

  // 检查卖单（Asks）
  if (topAsks.length >= 3) {
    const askVolumes = topAsks.map((ask) => ask[1]);
    const avgAskVolume = askVolumes.reduce((a, b) => a + b, 0) / askVolumes.length;
    
    // 找出异常大的单子（超过平均值5倍）
    for (let i = 0; i < topAsks.length; i++) {
      const volume = askVolumes[i];
      if (volume > avgAskVolume * 5 && volume > minVolumeForWall) {
        // 确保不是所有单子都很大（避免误判）
        const otherVolumes = askVolumes.filter((_, idx) => idx !== i);
        const otherAvg = otherVolumes.reduce((a, b) => a + b, 0) / otherVolumes.length;
        
        if (volume > otherAvg * 5) {
          results.push({
            type: 'danger',
            icon: '🔴',
            title: '假压盘检测',
            description: `检测到上方有巨额卖单墙 (可能是假压盘)`,
            price: topAsks[i][0],
            volume: volume,
            avgVolume: otherAvg,
            severity: 'high',
            timestamp: Date.now(),
          });
          break; // 只报告第一个异常大单
        }
      }
    }
  }

  // 2. 识别"真护盘/真压盘" (Ladder Support)
  // 检查买单前5-10档的分布
  if (topBids.length >= 5) {
    const bidVolumes = topBids.slice(0, 5).map((bid) => bid[1]);
    const avgVolume = bidVolumes.reduce((a, b) => a + b, 0) / bidVolumes.length;
    
    // 计算标准差
    const variance = bidVolumes.reduce((sum, vol) => sum + Math.pow(vol - avgVolume, 2), 0) / bidVolumes.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avgVolume > 0 ? stdDev / avgVolume : 0;
    
    // 如果平均挂单量大且分布均匀（变异系数 < 0.5）
    if (avgVolume > minAvgVolumeForLadder && coefficientOfVariation < 0.5) {
      const totalVolume = bidVolumes.reduce((a, b) => a + b, 0);
      const prices = topBids.slice(0, 5).map((bid) => bid[0]);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      results.push({
        type: 'success',
        icon: '🟢',
        title: '密集网格护盘',
        description: `检测到密集网格护盘 (支撑强劲)`,
        price: minPrice, // 最低价格
        avgVolume: avgVolume,
        totalVolume: totalVolume,
        severity: 'low',
        timestamp: Date.now(),
      });
    }
  }

  // 检查卖单前5-10档的分布
  if (topAsks.length >= 5) {
    const askVolumes = topAsks.slice(0, 5).map((ask) => ask[1]);
    const avgVolume = askVolumes.reduce((a, b) => a + b, 0) / askVolumes.length;
    
    // 计算标准差
    const variance = askVolumes.reduce((sum, vol) => sum + Math.pow(vol - avgVolume, 2), 0) / askVolumes.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avgVolume > 0 ? stdDev / avgVolume : 0;
    
    // 如果平均挂单量大且分布均匀（变异系数 < 0.5）
    if (avgVolume > minAvgVolumeForLadder && coefficientOfVariation < 0.5) {
      const totalVolume = askVolumes.reduce((a, b) => a + b, 0);
      const prices = topAsks.slice(0, 5).map((ask) => ask[0]);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      results.push({
        type: 'warning',
        icon: '🟡',
        title: '密集网格压盘',
        description: `检测到密集网格压盘 (上方压力大)`,
        price: minPrice, // 最低价格（最接近当前价）
        avgVolume: avgVolume,
        totalVolume: totalVolume,
        severity: 'medium',
        timestamp: Date.now(),
      });
    }
  }

  // 3. 识别"真空区/薄弱区" (Thin Liquidity)
  // 检查前3档的总挂单量
  if (topBids.length >= 3 && topAsks.length >= 3) {
    const top3BidVolume = topBids.slice(0, 3).reduce((sum, bid) => sum + bid[1], 0);
    const top3AskVolume = topAsks.slice(0, 3).reduce((sum, ask) => sum + ask[1], 0);
    const totalTop3Volume = top3BidVolume + top3AskVolume;
    
    // 如果前3档总挂单量很小，说明盘口很薄
    if (totalTop3Volume < maxTotalVolumeForThin) {
      results.push({
        type: 'danger',
        icon: '⚠️',
        title: '盘口真空',
        description: `盘口真空 (容易出现剧烈波动/插针)`,
        totalVolume: totalTop3Volume,
        severity: 'high',
        timestamp: Date.now(),
      });
    }
  }

  // 如果没有检测到任何特征，不返回正常状态（避免时间线被正常状态刷屏）
  // 只返回有意义的检测结果

  return results;
}

