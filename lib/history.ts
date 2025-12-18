// 历史评分记录管理

export interface HistoryRecord {
  id: string;
  symbol: string;
  timestamp: number;
  score: number;
  recommendation: 'strong-buy' | 'hold' | 'sell';
  fundingRate: number | null;
  longShortRatio: number | null;
  fearGreedIndex: number | null;
  price: number | null;
  inputs: {
    oiPattern: string;
    etfFlow: number;
    orderBookFeatures: string[];
  };
}

const STORAGE_KEY = 'crypto_vibe_scorer_history';
const MAX_HISTORY = 100; // 最多保存100条记录

export function saveHistoryRecord(record: Omit<HistoryRecord, 'id' | 'timestamp'>): void {
  try {
    const history = getHistoryRecords();
    const newRecord: HistoryRecord = {
      ...record,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    history.unshift(newRecord); // 最新的在前面
    const limitedHistory = history.slice(0, MAX_HISTORY);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedHistory));
  } catch (error) {
    console.error('保存历史记录失败:', error);
  }
}

export function getHistoryRecords(): HistoryRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('读取历史记录失败:', error);
    return [];
  }
}

export function getHistoryBySymbol(symbol: string): HistoryRecord[] {
  const history = getHistoryRecords();
  return history.filter(record => record.symbol.toUpperCase() === symbol.toUpperCase());
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('清空历史记录失败:', error);
  }
}

export function deleteHistoryRecord(id: string): void {
  try {
    const history = getHistoryRecords();
    const filtered = history.filter(record => record.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('删除历史记录失败:', error);
  }
}

