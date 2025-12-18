// 将盘口雷达分析结果转换为评分系统的盘口特征

import { OrderBookAnalysisResult } from './orderbook-analysis';

/**
 * 将盘口分析结果转换为评分特征
 * @param analysisResults 盘口分析结果数组
 * @returns 评分特征数组
 */
export function convertOrderBookToFeatures(
  analysisResults: OrderBookAnalysisResult[]
): string[] {
  const features: string[] = [];
  
  // 只使用最近的分析结果（避免重复计算）
  // 可以根据时间戳过滤，这里使用所有结果
  
  for (const result of analysisResults) {
    // 1. 密集网格护盘 -> real-support (+10分)
    if (result.title === '密集网格护盘') {
      if (!features.includes('real-support')) {
        features.push('real-support');
      }
    }
    
    // 2. 假护盘检测 -> fake-support (-5分)
    if (result.title === '假护盘检测') {
      if (!features.includes('fake-support')) {
        features.push('fake-support');
      }
    }
    
    // 3. 假压盘检测 -> fake-support (-5分) (压盘也是假信号)
    if (result.title === '假压盘检测') {
      if (!features.includes('fake-support')) {
        features.push('fake-support');
      }
    }
    
    // 4. 盘口真空 -> real-breakout (+15分) (真空区容易出现真突破)
    if (result.title === '盘口真空') {
      if (!features.includes('real-breakout')) {
        features.push('real-breakout');
      }
    }
    
    // 5. 密集网格压盘 -> 可以视为压力，但不计入负分（因为这是真实压力，不是假信号）
    // 如果需要，可以添加新的特征类型
  }
  
  return features;
}

/**
 * 根据盘口历史记录，智能提取当前最相关的特征
 * @param history 盘口历史记录（最近的分析结果）
 * @param timeWindowMs 时间窗口（毫秒），只考虑这个时间窗口内的结果
 * @returns 评分特征数组
 */
export function extractOrderBookFeatures(
  history: OrderBookAnalysisResult[],
  timeWindowMs: number = 60000 // 默认1分钟内的结果
): string[] {
  const now = Date.now();
  const recentResults = history.filter(
    result => now - result.timestamp < timeWindowMs
  );
  
  return convertOrderBookToFeatures(recentResults);
}

