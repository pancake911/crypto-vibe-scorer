/**
 * 盘口历史数据AI总结
 */

import { OrderBookAnalysisResult } from './orderbook-analysis';

export interface OrderBookSummary {
  summary: string;
  keyPoints: string[];
  riskLevel: 'low' | 'medium' | 'high';
  trend: 'bullish' | 'bearish' | 'neutral';
}

export function generateOrderBookSummary(
  history: OrderBookAnalysisResult[],
  symbol: string
): OrderBookSummary {
  // 获取过去一小时的数据
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentHistory = history.filter(h => h.timestamp >= oneHourAgo);

  if (recentHistory.length === 0) {
    return {
      summary: `过去一小时${symbol}盘口数据不足，无法生成总结。`,
      keyPoints: ['数据不足'],
      riskLevel: 'low',
      trend: 'neutral',
    };
  }

  // 统计各类信号
  const signalCounts = {
    fakeWall: 0, // 假护盘/假压盘
    ladder: 0, // 密集网格
    thin: 0, // 盘口真空
    danger: 0, // 高风险信号
    warning: 0, // 中风险信号
    success: 0, // 低风险信号
  };

  recentHistory.forEach(item => {
    if (item.title.includes('假护盘') || item.title.includes('假压盘')) {
      signalCounts.fakeWall++;
    }
    if (item.title.includes('密集网格')) {
      signalCounts.ladder++;
    }
    if (item.title.includes('盘口真空')) {
      signalCounts.thin++;
    }
    if (item.severity === 'high') {
      signalCounts.danger++;
    } else if (item.severity === 'medium') {
      signalCounts.warning++;
    } else if (item.severity === 'low') {
      signalCounts.success++;
    }
  });

  // 计算平均挂单量
  const volumes = recentHistory
    .filter(h => h.volume !== undefined)
    .map(h => h.volume!);
  const avgVolumes = recentHistory
    .filter(h => h.avgVolume !== undefined)
    .map(h => h.avgVolume!);
  
  const avgVolume = volumes.length > 0
    ? volumes.reduce((a, b) => a + b, 0) / volumes.length
    : 0;
  const avgLadderVolume = avgVolumes.length > 0
    ? avgVolumes.reduce((a, b) => a + b, 0) / avgVolumes.length
    : 0;

  // 生成总结
  const keyPoints: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';

  // 分析风险等级
  if (signalCounts.thin > 5 || signalCounts.danger > 10) {
    riskLevel = 'high';
    keyPoints.push('⚠️ 高风险：盘口频繁出现真空或异常大单');
  } else if (signalCounts.warning > 5 || signalCounts.danger > 3) {
    riskLevel = 'medium';
    keyPoints.push('⚠️ 中等风险：盘口存在一定异常');
  } else {
    riskLevel = 'low';
    keyPoints.push('✅ 风险较低：盘口相对稳定');
  }

  // 分析趋势
  const fakeWallRatio = signalCounts.fakeWall / recentHistory.length;
  const ladderRatio = signalCounts.ladder / recentHistory.length;
  
  if (fakeWallRatio > 0.3) {
    trend = 'bearish';
    keyPoints.push('📉 看跌信号：频繁出现假压盘，上方压力较大');
  } else if (ladderRatio > 0.3) {
    const supportLadder = recentHistory.filter(h => 
      h.title.includes('密集网格护盘')
    ).length;
    const pressureLadder = recentHistory.filter(h => 
      h.title.includes('密集网格压盘')
    ).length;
    
    if (supportLadder > pressureLadder) {
      trend = 'bullish';
      keyPoints.push('📈 看涨信号：下方支撑强劲，密集网格护盘较多');
    } else {
      trend = 'bearish';
      keyPoints.push('📉 看跌信号：上方压力较大，密集网格压盘较多');
    }
  } else {
    trend = 'neutral';
    keyPoints.push('➡️ 中性：盘口无明显趋势');
  }

  // 添加具体数据
  if (signalCounts.fakeWall > 0) {
    keyPoints.push(`🔍 检测到${signalCounts.fakeWall}次假护盘/假压盘信号`);
  }
  if (signalCounts.ladder > 0) {
    keyPoints.push(`🛡️ 检测到${signalCounts.ladder}次密集网格信号`);
    if (avgLadderVolume > 0) {
      keyPoints.push(`   平均挂单量: ${avgLadderVolume.toFixed(2)} ${symbol}`);
    }
  }
  if (signalCounts.thin > 0) {
    keyPoints.push(`⚠️ 检测到${signalCounts.thin}次盘口真空，需注意插针风险`);
  }

  // 生成总结文本
  let summary = `过去一小时${symbol}盘口分析：共检测到${recentHistory.length}个信号。`;
  
  if (signalCounts.fakeWall > 0) {
    summary += `出现${signalCounts.fakeWall}次异常大单（假护盘/假压盘），`;
  }
  if (signalCounts.ladder > 0) {
    summary += `检测到${signalCounts.ladder}次密集网格支撑/压力，`;
  }
  if (signalCounts.thin > 0) {
    summary += `出现${signalCounts.thin}次盘口真空。`;
  }

  if (avgVolume > 0) {
    summary += `平均异常挂单量约${avgVolume.toFixed(2)} ${symbol}。`;
  }

  summary += `整体风险等级：${riskLevel === 'high' ? '高' : riskLevel === 'medium' ? '中' : '低'}，趋势偏向${trend === 'bullish' ? '看涨' : trend === 'bearish' ? '看跌' : '中性'}。`;

  return {
    summary,
    keyPoints,
    riskLevel,
    trend,
  };
}

