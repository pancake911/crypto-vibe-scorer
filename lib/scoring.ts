// 打分逻辑

export interface ScoringInputs {
  // 自动获取的数据
  fundingRate: number; // 资金费率（百分比）
  longShortRatio: number | null; // 多空持仓比
  fearGreedIndex: number; // 恐惧贪婪指数 0-100
  oiScore1h?: number; // OI 1小时分析得分（可选）
  oiScore4h?: number; // OI 4小时分析得分（可选）
  
  // 用户手动输入
  oiPattern: string; // OI形态（已废弃，保留兼容性）
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
  // fundingRate是小数形式（如-0.0000349），需要转换为百分比进行比较
  const fundingRatePercent = inputs.fundingRate * 100; // 转换为百分比（如-0.00158%）
  const fundingRate = inputs.fundingRate;
  
  // 注意：阈值也需要相应调整（从0.10改为0.0010，因为现在是乘以100而不是10000）
  if (fundingRatePercent > 0.10) {
    totalScore -= 20;
    breakdown.push({
      category: '资金费率',
      score: -20,
      reason: `资金费率 ${fundingRatePercent.toFixed(5)}% > 0.10%，极端正费率，牛市尾声标志，开始无脑减仓`,
    });
  } else if (fundingRatePercent >= 0.07 && fundingRatePercent <= 0.09) {
    totalScore -= 10;
    breakdown.push({
      category: '资金费率',
      score: -10,
      reason: `资金费率 ${fundingRatePercent.toFixed(5)}% 在0.07%-0.09%之间，高烧预警，逐步减仓，只留底仓`,
    });
  } else if (fundingRatePercent >= 0.03 && fundingRatePercent <= 0.06) {
    // 正常偏高，可继续持有多单但不开新仓
    breakdown.push({
      category: '资金费率',
      score: 0,
      reason: `资金费率 ${fundingRatePercent.toFixed(5)}% 在0.03%-0.06%之间，正常偏高，可继续持有多单但不开新仓`,
    });
  } else if (fundingRatePercent >= 0 && fundingRatePercent <= 0.02) {
    totalScore += 10;
    breakdown.push({
      category: '资金费率',
      score: +10,
      reason: `资金费率 ${fundingRatePercent.toFixed(5)}% 在0%-0.02%之间，健康区间，最舒服的持仓阶段`,
    });
  } else if (fundingRatePercent >= -0.04 && fundingRatePercent <= -0.01) {
    totalScore += 20;
    breakdown.push({
      category: '资金费率',
      score: +20,
      reason: `资金费率 ${fundingRatePercent.toFixed(5)}% 在-0.01%到-0.04%之间，轻度负费率，最佳加仓区间（收钱还赚钱）`,
    });
  } else if (fundingRatePercent < -0.05) {
    totalScore += 30;
    breakdown.push({
      category: '资金费率',
      score: +30,
      reason: `资金费率 ${fundingRatePercent.toFixed(5)}% < -0.05%，无脑抄底信号`,
    });
  } else {
    breakdown.push({
      category: '资金费率',
      score: 0,
      reason: `资金费率 ${fundingRatePercent.toFixed(5)}%，中性`,
    });
  }

  // 2. 多空持仓比评分
  if (inputs.longShortRatio !== null) {
    const ratio = inputs.longShortRatio;
    if (ratio >= 3.0) {
      // 顶级账户比 ≥ 3.0 → 必炸多头，立即反手空
      totalScore -= 30;
      breakdown.push({
        category: '多空持仓比',
        score: -30,
        reason: `多空比 ${ratio.toFixed(2)} ≥ 3.0，必炸多头，立即反手空`,
      });
    } else if (ratio >= 2.5) {
      // 顶级账户比 ≥ 2.5 → 至少减仓70%，准备跑
      totalScore -= 20;
      breakdown.push({
        category: '多空持仓比',
        score: -20,
        reason: `多空比 ${ratio.toFixed(2)} ≥ 2.5，至少减仓70%，准备跑`,
      });
    } else if (ratio <= 0.4) {
      totalScore += 20;
      breakdown.push({
        category: '多空持仓比',
        score: +20,
        reason: `多空比 ${ratio.toFixed(2)} ≤ 0.4，空头必炸，满仓多单杠杆拉满`,
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
    // 极端贪婪 >90 → 减仓50%+ 或反手空（牛市尾声）
    totalScore -= 20;
    breakdown.push({
      category: '恐惧贪婪指数',
      score: -20,
      reason: `恐惧贪婪指数 ${fng} > 90，极端贪婪，全网看多信号，减仓50%+ 或反手空（牛市尾声）`,
    });
  } else if (fng > 75) {
    // 贪婪 >75 → 高风险预警，逐步减仓，只留底仓
    totalScore -= 10;
    breakdown.push({
      category: '恐惧贪婪指数',
      score: -10,
      reason: `恐惧贪婪指数 ${fng} > 75，贪婪，高风险预警，逐步减仓，只留底仓`,
    });
  } else if (fng >= 40 && fng <= 60) {
    // 中性 40~60 → 健康区间，可持仓但别追高
    breakdown.push({
      category: '恐惧贪婪指数',
      score: 0,
      reason: `恐惧贪婪指数 ${fng}，中性，健康区间，可持仓但别追高`,
    });
  } else if (fng < 10) {
    // 极端恐惧 <10 → 无脑定投/满仓多，闭眼拿住（熊市底）
    totalScore += 30;
    breakdown.push({
      category: '恐惧贪婪指数',
      score: +30,
      reason: `恐惧贪婪指数 ${fng} < 10，极端恐惧，无脑定投/满仓多，闭眼拿住（熊市底）`,
    });
  } else if (fng < 20) {
    // 恐惧 <20 → 轻度底信号，加仓20~30%
    totalScore += 15;
    breakdown.push({
      category: '恐惧贪婪指数',
      score: +15,
      reason: `恐惧贪婪指数 ${fng} < 20，恐惧，轻度底信号，加仓20~30%`,
    });
  } else {
    breakdown.push({
      category: '恐惧贪婪指数',
      score: 0,
      reason: `恐惧贪婪指数 ${fng}，中性`,
    });
  }

  // 4. OI趋势分析评分（自动获取，基于1小时和4小时OI分析）
  // 使用1小时和4小时OI分析得分的平均值，如果只有一个周期有数据则使用该周期
  let oiScore = 0;
  if (inputs.oiScore1h !== undefined && inputs.oiScore4h !== undefined) {
    // 两个周期都有数据，取平均值
    oiScore = Math.round((inputs.oiScore1h + inputs.oiScore4h) / 2);
  } else if (inputs.oiScore1h !== undefined) {
    oiScore = inputs.oiScore1h;
  } else if (inputs.oiScore4h !== undefined) {
    oiScore = inputs.oiScore4h;
  }
  
  if (oiScore !== 0) {
    totalScore += oiScore;
    const oiLabel = inputs.oiScore1h !== undefined && inputs.oiScore4h !== undefined
      ? 'OI趋势分析（1h+4h平均）'
      : inputs.oiScore1h !== undefined
      ? 'OI趋势分析（1h）'
      : 'OI趋势分析（4h）';
    breakdown.push({
      category: 'OI趋势分析',
      score: oiScore,
      reason: `${oiLabel}得分: ${oiScore > 0 ? '+' : ''}${oiScore}分`,
    });
  } else {
    breakdown.push({
      category: 'OI趋势分析',
      score: 0,
      reason: 'OI分析数据不可用',
    });
  }

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
