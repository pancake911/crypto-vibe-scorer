// 打分逻辑

export interface ScoringInputs {
  // 自动获取的数据
  fundingRate: number; // 资金费率（百分比）
  longShortRatio: number | null; // 多空持仓比
  fearGreedIndex: number; // 恐惧贪婪指数 0-100
  
  // 用户手动输入
  oiPattern: string; // OI形态
  etfFlow: number; // ETF资金流向（亿美元）
  orderBookFeatures: string[]; // 盘口挂单特征
}

export interface ScoreBreakdown {
  category: string;
  score: number;
  reason: string;
}

export interface ScoringResult {
  totalScore: number;
  breakdown: ScoreBreakdown[];
  recommendation: 'strong-buy' | 'hold' | 'sell';
  recommendationText: string;
}

export function calculateScore(inputs: ScoringInputs): ScoringResult {
  const breakdown: ScoreBreakdown[] = [];
  let totalScore = 50; // 起始分数50分

  // 1. 资金费率评分
  const fundingRate = inputs.fundingRate;
  if (fundingRate > 0.10) {
    totalScore -= 20;
    breakdown.push({
      category: '资金费率',
      score: -20,
      reason: `资金费率 ${fundingRate.toFixed(4)}% > 0.10%，极度危险，建议减仓`,
    });
  } else if (fundingRate >= 0.07 && fundingRate <= 0.09) {
    totalScore -= 10;
    breakdown.push({
      category: '资金费率',
      score: -10,
      reason: `资金费率 ${fundingRate.toFixed(4)}% 在0.07%-0.09%之间，预警`,
    });
  } else if (fundingRate >= 0 && fundingRate <= 0.02) {
    totalScore += 10;
    breakdown.push({
      category: '资金费率',
      score: +10,
      reason: `资金费率 ${fundingRate.toFixed(4)}% 在0%-0.02%之间，健康`,
    });
  } else if (fundingRate >= -0.04 && fundingRate <= -0.01) {
    totalScore += 20;
    breakdown.push({
      category: '资金费率',
      score: +20,
      reason: `资金费率 ${fundingRate.toFixed(4)}% 在-0.04%到-0.01%之间，最佳加仓时机`,
    });
  } else if (fundingRate < -0.05) {
    totalScore += 30;
    breakdown.push({
      category: '资金费率',
      score: +30,
      reason: `资金费率 ${fundingRate.toFixed(4)}% < -0.05%，无脑抄底信号`,
    });
  } else {
    breakdown.push({
      category: '资金费率',
      score: 0,
      reason: `资金费率 ${fundingRate.toFixed(4)}%，中性`,
    });
  }

  // 2. 多空持仓比评分
  if (inputs.longShortRatio !== null) {
    const ratio = inputs.longShortRatio;
    if (ratio > 2.5) {
      totalScore -= 20;
      breakdown.push({
        category: '多空持仓比',
        score: -20,
        reason: `多空比 ${ratio.toFixed(2)} > 2.5，多头拥挤，建议跑`,
      });
    } else if (ratio < 0.4) {
      totalScore += 20;
      breakdown.push({
        category: '多空持仓比',
        score: +20,
        reason: `多空比 ${ratio.toFixed(2)} < 0.4，空头拥挤，做多机会`,
      });
    } else {
      breakdown.push({
        category: '多空持仓比',
        score: 0,
        reason: `多空比 ${ratio.toFixed(2)}，中性`,
      });
    }
  } else {
    breakdown.push({
      category: '多空持仓比',
      score: 0,
      reason: '无法获取多空持仓比数据',
    });
  }

  // 3. 恐惧贪婪指数评分
  const fng = inputs.fearGreedIndex;
  if (fng > 90) {
    totalScore -= 20;
    breakdown.push({
      category: '恐惧贪婪指数',
      score: -20,
      reason: `恐惧贪婪指数 ${fng} > 90，极度贪婪，建议卖出`,
    });
  } else if (fng < 10) {
    totalScore += 30;
    breakdown.push({
      category: '恐惧贪婪指数',
      score: +30,
      reason: `恐惧贪婪指数 ${fng} < 10，极度恐惧，买入机会`,
    });
  } else {
    breakdown.push({
      category: '恐惧贪婪指数',
      score: 0,
      reason: `恐惧贪婪指数 ${fng}，中性`,
    });
  }

  // 4. OI形态评分（已移除手动输入，现在由自动OI分析提供）
  // OI分析现在在单独的模块中显示，不再计入总分
  // 如果需要将OI分析结果计入总分，可以在前端调用calculateScore时传入OI分析得分

  // 5. ETF资金流向评分
  const etfFlow = inputs.etfFlow;
  if (etfFlow > 10) {
    totalScore += 30;
    breakdown.push({
      category: 'ETF资金流向',
      score: +30,
      reason: `ETF净流入 ${etfFlow}亿美元 > 10亿，强烈看涨`,
    });
  } else if (etfFlow > 5) {
    totalScore += 15;
    breakdown.push({
      category: 'ETF资金流向',
      score: +15,
      reason: `ETF净流入 ${etfFlow}亿美元 > 5亿，看涨`,
    });
  } else if (etfFlow < -3) {
    totalScore -= 15;
    breakdown.push({
      category: 'ETF资金流向',
      score: -15,
      reason: `ETF连续流出 ${Math.abs(etfFlow)}亿美元 > 3亿，看跌`,
    });
  } else {
    breakdown.push({
      category: 'ETF资金流向',
      score: 0,
      reason: `ETF资金流向 ${etfFlow}亿美元，中性`,
    });
  }

  // 6. 盘口挂单特征评分
  const orderBookScores: Record<string, number> = {
    'real-support': 10,
    'fake-support': -5,
    'real-breakout': 15,
    'fake-support-removed': -15,
  };
  let orderBookTotal = 0;
  inputs.orderBookFeatures.forEach((feature) => {
    const score = orderBookScores[feature] || 0;
    orderBookTotal += score;
  });
  totalScore += orderBookTotal;
  if (orderBookTotal !== 0) {
    breakdown.push({
      category: '盘口挂单特征',
      score: orderBookTotal,
      reason: `盘口特征: ${inputs.orderBookFeatures.join(', ')}`,
    });
  } else {
    breakdown.push({
      category: '盘口挂单特征',
      score: 0,
      reason: '未选择盘口特征',
    });
  }

  // 限制分数在0-100之间
  totalScore = Math.max(0, Math.min(100, totalScore));

  // 生成建议
  let recommendation: 'strong-buy' | 'hold' | 'sell';
  let recommendationText: string;
  if (totalScore > 75) {
    recommendation = 'strong-buy';
    recommendationText = '强烈买入 (Strong Buy)';
  } else if (totalScore >= 40) {
    recommendation = 'hold';
    recommendationText = '持有/观望 (Hold)';
  } else {
    recommendation = 'sell';
    recommendationText = '减仓/卖出 (Sell)';
  }

  return {
    totalScore: Math.round(totalScore),
    breakdown,
    recommendation,
    recommendationText,
  };
}
