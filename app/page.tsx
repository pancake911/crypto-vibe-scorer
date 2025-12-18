'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { calculateScore, type ScoringInputs, type ScoringResult } from '@/lib/scoring';
import { analyzeOrderBook, type OrderBookAnalysisResult } from '@/lib/orderbook-analysis';
import { generateOrderBookSummary } from '@/lib/orderbook-summary';
import { saveHistoryRecord, getHistoryBySymbol, clearHistory, deleteHistoryRecord, type HistoryRecord } from '@/lib/history';
import { Charts } from '@/components/Charts';
import { extractOrderBookFeatures } from '@/lib/orderbook-to-features';

export default function Home() {
  const [symbol, setSymbol] = useState('BTC');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoringResult | null>(null);
  
  // 自动获取的数据
  const [fundingRate, setFundingRate] = useState<number | null>(null);
  const [longShortRatio, setLongShortRatio] = useState<number | null>(null);
  const [longShortRatioPeriod, setLongShortRatioPeriod] = useState<string>('5m');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('5m'); // 用户选择的周期
  const [fearGreedIndex, setFearGreedIndex] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  
  // 用户手动输入
  const [etfFlow, setEtfFlow] = useState(0);
  const [etfFlowCoin, setEtfFlowCoin] = useState(0); // 币本位ETF流入（用于转换）
  // orderBookFeatures 现在从盘口雷达自动提取，不再需要手动输入
  
  // 盘口分析 - 使用时间线数组保存历史记录
  const [orderBookHistory, setOrderBookHistory] = useState<OrderBookAnalysisResult[]>([]);
  const [orderBookLoading, setOrderBookLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(3000); // 默认3秒
  const [minVolumeForWall, setMinVolumeForWall] = useState<number>(100); // 假护盘/假压盘阈值
  const [minAvgVolumeForLadder, setMinAvgVolumeForLadder] = useState<number>(500); // 密集网格阈值
  const [maxTotalVolumeForThin, setMaxTotalVolumeForThin] = useState<number>(50); // 盘口真空阈值
  const orderBookIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const historyScrollRef = useRef<HTMLDivElement | null>(null);
  
  // 新闻数据
  const [news, setNews] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  
  // 历史记录
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // 图表数据历史（包含时间戳，最多保存10个数据点）
  const [fundingRateHistory, setFundingRateHistory] = useState<Array<{time: string, timestamp: number, value: number}>>([]);
  const [longShortRatioHistory, setLongShortRatioHistory] = useState<Array<{time: string, timestamp: number, value: number}>>([]);
  const [priceHistory, setPriceHistory] = useState<Array<{time: string, timestamp: number, value: number}>>([]);
  
  // 图表数据采集间隔（毫秒）
  const [chartInterval, setChartInterval] = useState<number>(60000); // 默认1分钟
  const chartIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // 多代币监控列表
  const [watchlist, setWatchlist] = useState<string[]>([]);
  
  // OI趋势分析数据
  const [oiAnalysis, setOiAnalysis] = useState<{
    '1h': any;
    '4h': any;
  } | null>(null);
  const [oiAnalysisLoading, setOiAnalysisLoading] = useState(false);

  // 获取新闻数据
  const fetchNews = async () => {
    if (!symbol) return;
    
    setNewsLoading(true);
    // 先清空之前的新闻，避免显示旧数据
    setNews([]);
    
    try {
      // 添加时间戳防止缓存
      const response = await fetch(`/api/news?symbol=${symbol}&limit=10&t=${Date.now()}`);
      const data = await response.json();
      
      if (data.success && data.data && data.data.news) {
        console.log(`获取到 ${symbol} 的新闻:`, data.data.news.length, '条');
        setNews(data.data.news);
      } else {
        console.error('获取新闻失败:', data.error || '未知错误');
        setNews([]); // 确保设置为空数组
      }
    } catch (error: any) {
      console.error('获取新闻失败:', error);
      setNews([]); // 出错时也清空
    } finally {
      setNewsLoading(false);
    }
  };

  // 获取自动数据（优化：使用并行请求）
  const fetchAutoData = async () => {
    setLoading(true);
    try {
      // 并行请求Binance数据和恐惧贪婪指数（提高速度）
      const [binanceRes, fngRes] = await Promise.allSettled([
        fetch(`/api/binance?symbol=${symbol}/USDT&period=${selectedPeriod}`),
        fetch('/api/fear-greed'),
      ]);
      
      // 处理Binance数据
      if (binanceRes.status === 'fulfilled') {
        const binanceData = await binanceRes.value.json();
        
        if (binanceData.success) {
          console.log('Binance数据:', binanceData.data); // 调试用
          const newFundingRate = binanceData.data.fundingRate;
          const newLongShortRatio = binanceData.data.longShortRatio;
          const newPrice = binanceData.data.price;
          
          setFundingRate(newFundingRate);
          setLongShortRatio(newLongShortRatio);
          setLongShortRatioPeriod(binanceData.data.longShortRatioPeriod || '5m');
          setPrice(newPrice);
          
          // 更新图表历史数据（最多保留10个数据点）
          const now = new Date();
          const timestamp = now.getTime();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          if (newFundingRate !== null) {
            setFundingRateHistory(prev => {
              // fundingRate已经是小数形式（如-0.0000349），需要乘以10000得到百分比显示值（-0.00349）
              const newData = [...prev, { time: timeStr, timestamp, value: newFundingRate * 10000 }];
              return newData.slice(-10); // 只保留最近10个
            });
          }
          
          if (newLongShortRatio !== null) {
            setLongShortRatioHistory(prev => {
              const newData = [...prev, { time: timeStr, timestamp, value: newLongShortRatio }];
              return newData.slice(-10); // 只保留最近10个
            });
          }
          
          if (newPrice !== null) {
            setPriceHistory(prev => {
              const newData = [...prev, { time: timeStr, timestamp, value: newPrice }];
              return newData.slice(-10); // 只保留最近10个
            });
          }
        } else {
          console.error('Binance API错误:', binanceData.error);
          // 不显示alert，只记录错误，避免打断用户体验
        }
      } else {
        console.error('Binance请求失败:', binanceRes.reason);
      }

      // 处理恐惧贪婪指数
      if (fngRes.status === 'fulfilled') {
        const fngData = await fngRes.value.json();
        
        if (fngData.success) {
          setFearGreedIndex(fngData.data.value);
        } else {
          console.error('恐惧贪婪指数API错误:', fngData.error);
        }
      } else {
        console.error('恐惧贪婪指数请求失败:', fngRes.reason);
      }
    } catch (error: any) {
      console.error('获取数据失败:', error);
      // 不显示alert，只记录错误
    } finally {
      setLoading(false);
    }
  };

  // 获取OI趋势分析（添加超时和更好的错误处理）
  // 如果服务器端API被限制，自动尝试客户端直接调用
  const fetchOIAnalysis = async () => {
    if (!symbol) return;
    
    setOiAnalysisLoading(true);
    try {
      const baseSymbol = symbol.toUpperCase().replace('/', '');
      const fullSymbol = `${baseSymbol}USDT`;
      
      // 添加超时控制（15秒）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      // 先尝试服务器端API
      const response = await fetch(`/api/oi-analysis?symbol=${fullSymbol}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (data.success && data.data) {
        // 检查是否获取到了真实OI数据
        const hasRealOI = data.data['1h']?.isRealOI || data.data['4h']?.isRealOI;
        const allFailed = data.data['1h']?.dataSource === 'failed' && data.data['4h']?.dataSource === 'failed';
        
        if (allFailed || !hasRealOI) {
          // 服务器端失败，尝试客户端直接调用
          console.log('服务器端API被限制，尝试客户端直接调用Binance API...');
          await fetchOIAnalysisClientDirect(fullSymbol);
        } else {
          // 服务器端成功，使用服务器端数据
          setOiAnalysis(data.data);
        }
      } else {
        // 服务器端完全失败，尝试客户端直接调用
        console.log('服务器端API失败，尝试客户端直接调用...');
        await fetchOIAnalysisClientDirect(fullSymbol);
      }
    } catch (error: any) {
      console.error('获取OI分析失败:', error);
      if (error.name === 'AbortError') {
        console.error('OI分析请求超时（15秒）');
      }
      // 即使超时，也尝试客户端直接调用
      const baseSymbol = symbol.toUpperCase().replace('/', '');
      await fetchOIAnalysisClientDirect(`${baseSymbol}USDT`);
    } finally {
      setOiAnalysisLoading(false);
    }
  };

  // 客户端直接调用Binance API获取真实OI数据（绕过服务器限制）
  const fetchOIAnalysisClientDirect = async (fullSymbol: string) => {
    try {
      console.log('客户端直接调用Binance API获取真实OI数据...');
      
      // 并行获取价格和OI数据
      const [price1hRes, price4hRes, oi1hRes, oi4hRes] = await Promise.allSettled([
        // 1小时价格
        fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${fullSymbol}&interval=1h&limit=2`),
        // 4小时价格
        fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${fullSymbol}&interval=4h&limit=2`),
        // 1小时OI历史
        fetch(`https://fapi.binance.com/futures/data/openInterestHistory?symbol=${fullSymbol}&period=1h&limit=2`),
        // 4小时OI历史
        fetch(`https://fapi.binance.com/futures/data/openInterestHistory?symbol=${fullSymbol}&period=4h&limit=2`),
      ]);

      // 处理1小时数据
      let analysis1h: any = null;
      if (price1hRes.status === 'fulfilled' && oi1hRes.status === 'fulfilled') {
        try {
          const priceData = await price1hRes.value.json();
          const oiData = await oi1hRes.value.json();
          
          if (Array.isArray(priceData) && priceData.length >= 2 && Array.isArray(oiData) && oiData.length >= 2) {
            const currentPrice = parseFloat(priceData[0][4]);
            const previousPrice = parseFloat(priceData[1][4]);
            const priceChange = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
            
            const currentOI = parseFloat(oiData[0].sumOpenInterest || oiData[0].openInterest || 0);
            const previousOI = parseFloat(oiData[1].sumOpenInterest || oiData[1].openInterest || 0);
            const oiChange = previousOI > 0 ? ((currentOI - previousOI) / previousOI) * 100 : 0;
            
            // 简单的分析逻辑（与服务器端保持一致）
            let label = '⚪ 无明显信号';
            let description = '价格和OI变化都在正常范围内';
            let score = 0;
            let status: 'healthy' | 'danger' | 'opportunity' | 'accumulation' | 'crash' = 'healthy';
            
            if (priceChange > 0.5 && oiChange > 0.5) {
              label = '🟢 趋势健康 (资金做多)';
              description = '价格上涨且OI上涨，资金进场推动上涨';
              score = 10;
              status = 'healthy';
            } else if (priceChange > 0.5 && oiChange < -0.5) {
              label = '🔴 顶部背离 (多头跑路)';
              description = '价格新高但多头离场，只剩下散户在冲';
              score = -15;
              status = 'danger';
            } else if (priceChange < -1 && oiChange > 2) {
              label = '🟡 底部异动 (恐慌盘/强力换手)';
              description = '下跌中有人疯狂开仓，可能是被动爆仓后的V反，或者是主力接针';
              score = 15;
              status = 'opportunity';
            } else if (Math.abs(priceChange) <= 0.2 && oiChange > 1) {
              label = '🔵 主力潜伏 (蓄势待发)';
              description = '价格横盘但OI持续上涨，暗中建仓';
              score = 10;
              status = 'accumulation';
            } else if (oiChange < -5) {
              label = '⚠️ 多头大逃亡 (大清算)';
              description = 'OI单次暴跌，多头大逃亡';
              score = -20;
              status = 'crash';
            }
            
            analysis1h = {
              period: '1h',
              priceChange,
              oiChange,
              score,
              label,
              description,
              status,
              dataSource: 'client_direct_binance',
              isRealOI: true,
            };
            console.log('✅ 客户端获取1h真实OI数据成功');
          }
        } catch (e: any) {
          console.log('客户端处理1h数据失败:', e.message);
        }
      }

      // 处理4小时数据
      let analysis4h: any = null;
      if (price4hRes.status === 'fulfilled' && oi4hRes.status === 'fulfilled') {
        try {
          const priceData = await price4hRes.value.json();
          const oiData = await oi4hRes.value.json();
          
          if (Array.isArray(priceData) && priceData.length >= 2 && Array.isArray(oiData) && oiData.length >= 2) {
            const currentPrice = parseFloat(priceData[0][4]);
            const previousPrice = parseFloat(priceData[1][4]);
            const priceChange = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
            
            const currentOI = parseFloat(oiData[0].sumOpenInterest || oiData[0].openInterest || 0);
            const previousOI = parseFloat(oiData[1].sumOpenInterest || oiData[1].openInterest || 0);
            const oiChange = previousOI > 0 ? ((currentOI - previousOI) / previousOI) * 100 : 0;
            
            // 简单的分析逻辑
            let label = '⚪ 无明显信号';
            let description = '价格和OI变化都在正常范围内';
            let score = 0;
            let status: 'healthy' | 'danger' | 'opportunity' | 'accumulation' | 'crash' = 'healthy';
            
            if (priceChange > 0.5 && oiChange > 0.5) {
              label = '🟢 趋势健康 (资金做多)';
              description = '价格上涨且OI上涨，资金进场推动上涨';
              score = 10;
              status = 'healthy';
            } else if (priceChange > 0.5 && oiChange < -0.5) {
              label = '🔴 顶部背离 (多头跑路)';
              description = '价格新高但多头离场，只剩下散户在冲';
              score = -15;
              status = 'danger';
            } else if (priceChange < -1 && oiChange > 2) {
              label = '🟡 底部异动 (恐慌盘/强力换手)';
              description = '下跌中有人疯狂开仓，可能是被动爆仓后的V反，或者是主力接针';
              score = 15;
              status = 'opportunity';
            } else if (Math.abs(priceChange) <= 0.2 && oiChange > 1) {
              label = '🔵 主力潜伏 (蓄势待发)';
              description = '价格横盘但OI持续上涨，暗中建仓';
              score = 10;
              status = 'accumulation';
            } else if (oiChange < -5) {
              label = '⚠️ 多头大逃亡 (大清算)';
              description = 'OI单次暴跌，多头大逃亡';
              score = -20;
              status = 'crash';
            }
            
            analysis4h = {
              period: '4h',
              priceChange,
              oiChange,
              score,
              label,
              description,
              status,
              dataSource: 'client_direct_binance',
              isRealOI: true,
            };
            console.log('✅ 客户端获取4h真实OI数据成功');
          }
        } catch (e: any) {
          console.log('客户端处理4h数据失败:', e.message);
        }
      }

      // 如果获取到了数据，设置到state
      if (analysis1h || analysis4h) {
        setOiAnalysis({
          '1h': analysis1h,
          '4h': analysis4h,
        });
        console.log('✅ 客户端直接调用成功，已获取真实OI数据');
      } else {
        console.log('❌ 客户端直接调用也失败（可能是CORS限制）');
        // 如果客户端也失败，显示错误信息
        setOiAnalysis({
          '1h': {
            period: '1h',
            priceChange: 0,
            oiChange: 0,
            score: 0,
            label: '❌ 无法获取真实OI数据',
            description: '服务器端和客户端都无法获取数据。可能是CORS限制或网络问题。',
            status: 'healthy',
            dataSource: 'failed',
            isRealOI: false,
          },
          '4h': {
            period: '4h',
            priceChange: 0,
            oiChange: 0,
            score: 0,
            label: '❌ 无法获取真实OI数据',
            description: '服务器端和客户端都无法获取数据。可能是CORS限制或网络问题。',
            status: 'healthy',
            dataSource: 'failed',
            isRealOI: false,
          },
        });
      }
    } catch (e: any) {
      console.error('客户端直接调用失败:', e.message);
      setOiAnalysis(null);
    }
  };

  // 获取历史数据（用于初始化图表）
  const fetchHistoryData = async () => {
    try {
      const baseSymbol = symbol.toUpperCase().replace('/', '');
      const response = await fetch(`/api/binance-history?symbol=${baseSymbol}USDT&limit=10`);
      const data = await response.json();
      
      if (data.success && data.data) {
        // 填充历史数据到图表
        if (data.data.fundingRate && data.data.fundingRate.length > 0) {
          setFundingRateHistory(data.data.fundingRate);
        }
        if (data.data.price && data.data.price.length > 0) {
          setPriceHistory(data.data.price);
        }
        if (data.data.longShortRatio && data.data.longShortRatio.length > 0) {
          setLongShortRatioHistory(data.data.longShortRatio);
        }
      }
    } catch (error: any) {
      console.error('获取历史数据失败:', error);
    }
  };

  // 图表数据自动采集定时器
  useEffect(() => {
    // 清空之前的图表数据
    setFundingRateHistory([]);
    setLongShortRatioHistory([]);
    setPriceHistory([]);
    
    // 先获取历史数据填充图表
    fetchHistoryData();
    
    // 获取OI趋势分析
    fetchOIAnalysis();
    
    // 立即获取一次最新数据
    fetchAutoData();
    
    // 设置定时器，根据选择的间隔自动获取数据
    if (chartIntervalRef.current) {
      clearInterval(chartIntervalRef.current);
    }
    chartIntervalRef.current = setInterval(() => {
      fetchAutoData();
    }, chartInterval);
    
    return () => {
      if (chartIntervalRef.current) {
        clearInterval(chartIntervalRef.current);
      }
    };
  }, [symbol, chartInterval]); // 当symbol或chartInterval改变时重新设置

  useEffect(() => {
    // 当symbol改变时，重置ETF相关数据
    setEtfFlow(0);
    setEtfFlowCoin(0);
    // 重新获取自动数据（这个会触发上面的定时器）
    // 获取新闻
    fetchNews();
    // 获取OI分析
    fetchOIAnalysis();
    
    // 获取盘口数据并分析（添加超时控制）
    const fetchOrderBook = async () => {
      if (!symbol) return;
      
      setOrderBookLoading(true);
      try {
        const baseSymbol = symbol.toUpperCase().replace('/', '');
        // 添加超时控制（8秒）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(`/api/orderbook?symbol=${baseSymbol}USDT&limit=20`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        const data = await response.json();
        
        if (data.success && data.data) {
          const analysis = analyzeOrderBook(data.data.bids, data.data.asks, {
            minVolumeForWall,
            minAvgVolumeForLadder,
            maxTotalVolumeForThin,
          });
          // 只添加有意义的检测结果（过滤掉正常状态）
          const meaningfulResults = analysis.filter(r => r.type !== 'info');
          
          if (meaningfulResults.length > 0) {
            // 添加到历史记录，保留最近100条
            setOrderBookHistory(prev => {
              const newHistory = [...prev, ...meaningfulResults];
              return newHistory.slice(-100); // 只保留最近100条
            });
            
            // 自动滚动到底部
            setTimeout(() => {
              if (historyScrollRef.current) {
                historyScrollRef.current.scrollTop = historyScrollRef.current.scrollHeight;
              }
            }, 100);
          }
        } else {
          console.error('获取盘口数据失败:', data.error);
        }
      } catch (error: any) {
        console.error('获取盘口数据失败:', error);
        if (error.name === 'AbortError') {
          console.error('盘口数据请求超时（8秒）');
        }
      } finally {
        setOrderBookLoading(false);
      }
    };
    
    // 立即获取一次盘口数据
    fetchOrderBook();
    
    // 设置定时器，每3秒刷新一次盘口数据
    if (orderBookIntervalRef.current) {
      clearInterval(orderBookIntervalRef.current);
    }
    orderBookIntervalRef.current = setInterval(() => {
      fetchOrderBook();
    }, 3000);
    
    // 清理定时器
    return () => {
      if (orderBookIntervalRef.current) {
        clearInterval(orderBookIntervalRef.current);
      }
    };
  }, [symbol, selectedPeriod, refreshInterval, minVolumeForWall, minAvgVolumeForLadder, maxTotalVolumeForThin]); // 当相关参数改变时，重新获取数据

  // 单独处理新闻获取，避免依赖问题
  useEffect(() => {
    // 当symbol改变时，立即清空新闻并重新获取
    setNews([]);
    setNewsLoading(true);
    fetchNews();
    
    // 加载该代币的历史记录
    setHistoryRecords(getHistoryBySymbol(symbol));
  }, [symbol]); // 当symbol改变时，重新获取新闻

  const handleCalculate = () => {
    if (fundingRate === null || fearGreedIndex === null) {
      alert('请先获取自动数据');
      return;
    }

    // 从盘口雷达历史记录中自动提取特征（使用最近1分钟的数据）
    const autoOrderBookFeatures = extractOrderBookFeatures(orderBookHistory, 60000);

    const inputs: ScoringInputs = {
      fundingRate,
      longShortRatio,
      fearGreedIndex,
      oiPattern: 'none', // OI现在由自动分析提供，手动输入已移除
      etfFlow,
      orderBookFeatures: autoOrderBookFeatures, // 使用自动提取的盘口特征
    };

    const scoringResult = calculateScore(inputs);
    setResult(scoringResult);
    
    // 保存历史记录
    saveHistoryRecord({
      symbol,
      score: scoringResult.totalScore,
      recommendation: scoringResult.recommendation,
      fundingRate,
      longShortRatio,
      fearGreedIndex,
      price,
      inputs: {
        oiPattern: 'none', // OI现在由自动分析提供
        etfFlow,
        orderBookFeatures: extractOrderBookFeatures(orderBookHistory, 60000), // 自动提取盘口特征
      },
    });
    
    // 更新历史记录列表
    setHistoryRecords(getHistoryBySymbol(symbol));
  };

  // toggleOrderBookFeature 已移除，盘口特征现在由盘口雷达自动提取

  // 计算时间差（多久前）
  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return '刚刚';
  };

  // 检查代币是否有ETF数据
  const hasETFData = (tokenSymbol: string): boolean => {
    // 目前有ETF的主要代币
    const tokensWithETF = ['BTC', 'ETH', 'SOL', 'XRP'];
    return tokensWithETF.includes(tokenSymbol.toUpperCase());
  };

  // 获取ETF查询链接
  const getETFLink = (tokenSymbol: string): string => {
    const upperSymbol = tokenSymbol.toUpperCase();
    // Coinglass ETF页面 - 使用正确的URL格式
    const symbolMap: Record<string, string> = {
      'BTC': 'https://www.coinglass.com/bitcoin-etf',
      'ETH': 'https://www.coinglass.com/eth-etf',
      'SOL': 'https://www.coinglass.com/sol-etf',
      'XRP': 'https://www.coinglass.com/xrp-etf',
    };
    
    // 如果代币在映射表中，使用对应的ETF页面
    if (symbolMap[upperSymbol]) {
      return symbolMap[upperSymbol];
    }
    
    // 其他代币返回主ETF页面，用户可以在页面内查找
    return 'https://www.coinglass.com/etf';
  };

  return (
    <div className="min-h-screen bg-bloomberg-dark p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-bloomberg-text mb-2">
            Crypto Vibe Scorer
          </h1>
          <p className="text-bloomberg-text-dim mb-4">
            代币打分系统 - 量化交易辅助决策仪表盘
          </p>
          
          {/* 醒目的信息栏 */}
          <div className="bg-gradient-to-r from-bloomberg-blue/20 to-bloomberg-green/20 border border-bloomberg-blue/50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-bloomberg-text">
                根据
                <a 
                  href="https://x.com/hazenlee" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mx-1 text-bloomberg-blue hover:text-bloomberg-green transition-colors font-semibold"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  李哥大佬
                </a>
                思路做的合约参考指标，未来会做更多好玩的小工具，请关注
                <a 
                  href="https://x.com/ChinaWeb3" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mx-1 text-bloomberg-blue hover:text-bloomberg-green transition-colors font-semibold"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  @ChinaWeb3
                </a>
              </span>
            </div>
          </div>
        </div>

        {/* 结果展示区域 */}
        {result && (
          <div className="mb-8 bg-bloomberg-darker border border-bloomberg-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">综合得分</h2>
                <div className="text-5xl font-bold">
                  {result.totalScore}
                  <span className="text-2xl text-bloomberg-text-dim">/100</span>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-4xl mb-2 ${
                  result.recommendation === 'strong-buy' ? 'text-bloomberg-green' :
                  result.recommendation === 'hold' ? 'text-bloomberg-yellow' :
                  'text-bloomberg-red'
                }`}>
                  {result.recommendation === 'strong-buy' ? '🟢' :
                   result.recommendation === 'hold' ? '🟡' : '🔴'}
                </div>
                <div className="text-xl font-semibold">
                  {result.recommendationText}
                </div>
              </div>
            </div>
            
            {/* 历史记录按钮 */}
            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="px-4 py-2 bg-bloomberg-dark border border-bloomberg-border rounded text-sm text-bloomberg-text hover:bg-bloomberg-border transition-colors"
              >
                {showHistory ? '隐藏' : '查看'}历史记录 ({historyRecords.length})
              </button>
              {historyRecords.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('确定要清空所有历史记录吗？')) {
                      clearHistory();
                      setHistoryRecords([]);
                    }
                  }}
                  className="px-4 py-2 bg-bloomberg-dark border border-bloomberg-border rounded text-sm text-bloomberg-text-dim hover:text-bloomberg-text hover:bg-bloomberg-border transition-colors"
                >
                  清空历史
                </button>
              )}
            </div>
            
            {/* 历史记录列表 */}
            {showHistory && historyRecords.length > 0 && (
              <div className="mt-4 border-t border-bloomberg-border pt-4">
                <h3 className="text-lg font-semibold mb-3">历史评分记录</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {historyRecords.map((record) => {
                    const date = new Date(record.timestamp);
                    const timeStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                    return (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-3 bg-bloomberg-dark rounded border border-bloomberg-border"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`text-2xl ${
                            record.recommendation === 'strong-buy' ? 'text-bloomberg-green' :
                            record.recommendation === 'hold' ? 'text-bloomberg-yellow' :
                            'text-bloomberg-red'
                          }`}>
                            {record.recommendation === 'strong-buy' ? '🟢' :
                             record.recommendation === 'hold' ? '🟡' : '🔴'}
                          </div>
                          <div>
                            <div className="text-lg font-bold">{record.score}/100</div>
                            <div className="text-xs text-bloomberg-text-dim">{timeStr}</div>
                          </div>
                          <div className="text-sm text-bloomberg-text-dim">
                            {record.fundingRate !== null && `费率: ${(record.fundingRate * 10000).toFixed(5)}%`}
                            {record.longShortRatio !== null && ` | 多空比: ${record.longShortRatio.toFixed(2)}`}
                            {record.fearGreedIndex !== null && ` | F&G: ${record.fearGreedIndex}`}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            deleteHistoryRecord(record.id);
                            setHistoryRecords(getHistoryBySymbol(symbol));
                          }}
                          className="text-xs text-bloomberg-text-dim hover:text-bloomberg-red transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 详细报告 */}
            <div className="mt-6 border-t border-bloomberg-border pt-4">
              <h3 className="text-lg font-semibold mb-3">详细得分报告</h3>
              <div className="space-y-2">
                {result.breakdown.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-3 bg-bloomberg-dark rounded border border-bloomberg-border"
                  >
                    <div className="flex-1">
                      <span className="font-medium">{item.category}:</span>
                      <span className="ml-2 text-bloomberg-text-dim">
                        {item.reason}
                      </span>
                    </div>
                    <div className={`ml-4 font-bold ${
                      item.score > 0 ? 'text-bloomberg-green' :
                      item.score < 0 ? 'text-bloomberg-red' :
                      'text-bloomberg-text-dim'
                    }`}>
                      {item.score > 0 ? '+' : ''}{item.score}分
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* OI趋势分析 */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-bloomberg-text mb-1">📈 OI 趋势自动分析</h2>
              <p className="text-sm text-bloomberg-text-dim">基于持仓量(OI)和价格变化分析资金流向，识别市场趋势信号</p>
            </div>
            <button
              onClick={fetchOIAnalysis}
              disabled={oiAnalysisLoading}
              className="px-3 py-1.5 bg-bloomberg-dark border border-bloomberg-border rounded text-xs text-bloomberg-text hover:bg-bloomberg-border transition-colors disabled:opacity-50"
            >
              {oiAnalysisLoading ? '分析中...' : '刷新分析'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1小时资金流向 */}
            <div className="bg-bloomberg-darker border border-bloomberg-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-bloomberg-text">{symbol.toUpperCase()} 1小时 OI 趋势</h3>
                {oiAnalysisLoading && (
                  <span className="text-xs text-bloomberg-text-dim animate-pulse">分析中...</span>
                )}
              </div>
            {oiAnalysis && oiAnalysis['1h'] ? (
              <div>
                <div className={`text-2xl font-bold mb-2 ${
                  oiAnalysis['1h'].status === 'danger' || oiAnalysis['1h'].status === 'crash'
                    ? 'text-bloomberg-red'
                    : oiAnalysis['1h'].status === 'opportunity' || oiAnalysis['1h'].status === 'accumulation'
                    ? 'text-bloomberg-green'
                    : 'text-bloomberg-blue'
                }`}>
                  {oiAnalysis['1h'].label}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-bloomberg-text-dim">价格变化:</span>
                    <span className={`font-medium ${
                      oiAnalysis['1h'].priceChange > 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'
                    }`}>
                      {oiAnalysis['1h'].priceChange > 0 ? '⬆️' : '⬇️'} {Math.abs(oiAnalysis['1h'].priceChange).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-bloomberg-text-dim">OI变化:</span>
                    <span className={`font-medium ${
                      oiAnalysis['1h'].oiChange > 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'
                    }`}>
                      {oiAnalysis['1h'].oiChange > 0 ? '⬆️' : '⬇️'} {Math.abs(oiAnalysis['1h'].oiChange).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-bloomberg-text-dim">得分:</span>
                    <span className={`font-bold ${
                      oiAnalysis['1h'].score > 0 ? 'text-bloomberg-green' : oiAnalysis['1h'].score < 0 ? 'text-bloomberg-red' : 'text-bloomberg-text-dim'
                    }`}>
                      {oiAnalysis['1h'].score > 0 ? '+' : ''}{oiAnalysis['1h'].score} 分
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-bloomberg-border">
                    <p className="text-xs text-bloomberg-text-dim">{oiAnalysis['1h'].description}</p>
                    {oiAnalysis['1h'].isRealOI !== undefined && (
                      <p className="text-xs mt-1 ${
                        oiAnalysis['1h'].isRealOI ? 'text-bloomberg-green' : 'text-bloomberg-yellow'
                      }">
                        {oiAnalysis['1h'].isRealOI ? '✅ 真实OI数据' : '⚠️ 估算数据（真实OI不可用）'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-bloomberg-text-dim text-sm">
                {oiAnalysisLoading ? (
                  <div className="space-y-2">
                    <div className="animate-pulse">正在分析OI趋势...</div>
                    <div className="text-xs">从币安获取持仓量数据</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>⚠️ 暂无OI数据</div>
                    <div className="text-xs">可能原因：币安API限制或数据源暂时不可用</div>
                  </div>
                )}
              </div>
            )}
          </div>

            {/* 4小时资金流向 */}
            <div className="bg-bloomberg-darker border border-bloomberg-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-bloomberg-text">{symbol.toUpperCase()} 4小时 OI 趋势</h3>
                {oiAnalysisLoading && (
                  <span className="text-xs text-bloomberg-text-dim animate-pulse">分析中...</span>
                )}
              </div>
            {oiAnalysis && oiAnalysis['4h'] ? (
              <div>
                <div className={`text-2xl font-bold mb-2 ${
                  oiAnalysis['4h'].status === 'danger' || oiAnalysis['4h'].status === 'crash'
                    ? 'text-bloomberg-red'
                    : oiAnalysis['4h'].status === 'opportunity' || oiAnalysis['4h'].status === 'accumulation'
                    ? 'text-bloomberg-green'
                    : 'text-bloomberg-blue'
                }`}>
                  {oiAnalysis['4h'].label}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-bloomberg-text-dim">价格变化:</span>
                    <span className={`font-medium ${
                      oiAnalysis['4h'].priceChange > 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'
                    }`}>
                      {oiAnalysis['4h'].priceChange > 0 ? '⬆️' : '⬇️'} {Math.abs(oiAnalysis['4h'].priceChange).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-bloomberg-text-dim">OI变化:</span>
                    <span className={`font-medium ${
                      oiAnalysis['4h'].oiChange > 0 ? 'text-bloomberg-green' : 'text-bloomberg-red'
                    }`}>
                      {oiAnalysis['4h'].oiChange > 0 ? '⬆️' : '⬇️'} {Math.abs(oiAnalysis['4h'].oiChange).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-bloomberg-text-dim">得分:</span>
                    <span className={`font-bold ${
                      oiAnalysis['4h'].score > 0 ? 'text-bloomberg-green' : oiAnalysis['4h'].score < 0 ? 'text-bloomberg-red' : 'text-bloomberg-text-dim'
                    }`}>
                      {oiAnalysis['4h'].score > 0 ? '+' : ''}{oiAnalysis['4h'].score} 分
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-bloomberg-border">
                    <p className="text-xs text-bloomberg-text-dim">{oiAnalysis['4h'].description}</p>
                    {oiAnalysis['4h'].isRealOI !== undefined && (
                      <p className={`text-xs mt-1 ${
                        oiAnalysis['4h'].isRealOI ? 'text-bloomberg-green' : 'text-bloomberg-yellow'
                      }`}>
                        {oiAnalysis['4h'].isRealOI ? '✅ 真实OI数据' : '⚠️ 估算数据（真实OI不可用）'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-bloomberg-text-dim text-sm">
                {oiAnalysisLoading ? (
                  <div className="space-y-2">
                    <div className="animate-pulse">正在分析OI趋势...</div>
                    <div className="text-xs">从币安获取持仓量数据</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>⚠️ 暂无OI数据</div>
                    <div className="text-xs">可能原因：币安API限制或数据源暂时不可用</div>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>

        {/* 图表可视化 */}
        <div className="mb-6 bg-bloomberg-darker border border-bloomberg-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-bloomberg-text">📊 数据趋势图</h3>
            <div className="flex items-center gap-2">
              <label className="text-sm text-bloomberg-text-dim">采集间隔:</label>
              <select
                value={chartInterval}
                onChange={(e) => {
                  const newInterval = Number(e.target.value);
                  setChartInterval(newInterval);
                  // 重新设置定时器
                  if (chartIntervalRef.current) {
                    clearInterval(chartIntervalRef.current);
                  }
                  chartIntervalRef.current = setInterval(() => {
                    fetchAutoData();
                  }, newInterval);
                }}
                className="px-3 py-1 bg-bloomberg-dark border border-bloomberg-border rounded text-sm text-bloomberg-text focus:outline-none focus:border-bloomberg-blue"
              >
                <option value={60000}>1分钟</option>
                <option value={300000}>5分钟</option>
                <option value={600000}>10分钟</option>
                <option value={1800000}>30分钟</option>
                <option value={3600000}>1小时</option>
                <option value={7200000}>2小时</option>
                <option value={14400000}>4小时</option>
                <option value={28800000}>8小时</option>
                <option value={86400000}>24小时</option>
              </select>
            </div>
          </div>
          {(fundingRateHistory.length > 0 || longShortRatioHistory.length > 0 || priceHistory.length > 0) ? (
            <Charts 
              fundingRateHistory={fundingRateHistory}
              longShortRatioHistory={longShortRatioHistory}
              priceHistory={priceHistory}
            />
          ) : (
            <div className="text-center py-8 text-bloomberg-text-dim">
              等待数据采集... 数据将根据选择的间隔自动更新
            </div>
          )}
        </div>

        {/* 主要内容区域 - 优化布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* 左侧：自动数据获取 */}
          <div className="bg-bloomberg-darker border border-bloomberg-border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">📊 自动获取数据</h2>
            
            {/* 代币输入 */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                代币名称
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="flex-1 bg-bloomberg-dark border border-bloomberg-border rounded px-4 py-2 text-bloomberg-text focus:outline-none focus:border-bloomberg-blue"
                  placeholder="BTC, ETH, etc."
                />
                <button
                  onClick={fetchAutoData}
                  disabled={loading}
                  className="px-6 py-2 bg-bloomberg-blue text-white rounded hover:bg-opacity-80 disabled:opacity-50"
                >
                  {loading ? '获取中...' : '获取数据'}
                </button>
              </div>
            </div>

            {/* 数据显示 */}
            <div className="space-y-4">
              <div className="p-4 bg-bloomberg-dark rounded border border-bloomberg-border">
                <div className="text-sm text-bloomberg-text-dim mb-1">当前价格</div>
                <div className="text-2xl font-bold">
                  {price !== null ? `$${price.toLocaleString()}` : '-'}
                </div>
              </div>

              <div className="p-4 bg-bloomberg-dark rounded border border-bloomberg-border">
                <div className="text-sm text-bloomberg-text-dim mb-1">资金费率</div>
                <div className={`text-2xl font-bold ${
                  fundingRate !== null && fundingRate * 10000 > 0.07 ? 'text-bloomberg-red' :
                  fundingRate !== null && fundingRate * 10000 < -0.01 ? 'text-bloomberg-green' :
                  'text-bloomberg-text'
                }`}>
                  {fundingRate !== null ? `${(fundingRate * 10000).toFixed(5)}%` : loading ? '获取中...' : '未获取'}
                </div>
                {fundingRate !== null && (
                  <div className="text-xs text-bloomberg-text-dim mt-1">
                    {fundingRate * 10000 > 0.07 ? '⚠️ 极度危险' : 
                     fundingRate * 10000 > 0 ? '多头付费' : 
                     fundingRate * 10000 < -0.01 ? '✅ 空头付费（做多机会）' : '中性'}
                  </div>
                )}
                {fundingRate === null && !loading && (
                  <div className="text-xs text-bloomberg-text-dim mt-1">点击"获取数据"按钮</div>
                )}
              </div>

              <div className="p-4 bg-bloomberg-dark rounded border border-bloomberg-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-bloomberg-text-dim">多空持仓比</div>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="bg-bloomberg-dark border border-bloomberg-border rounded px-2 py-1 text-xs text-bloomberg-text focus:outline-none focus:border-bloomberg-blue"
                  >
                    <option value="5m">5分钟</option>
                    <option value="15m">15分钟</option>
                    <option value="30m">30分钟</option>
                    <option value="1h">1小时</option>
                    <option value="2h">2小时</option>
                    <option value="4h">4小时</option>
                    <option value="6h">6小时</option>
                    <option value="12h">12小时</option>
                    <option value="1d">1天</option>
                  </select>
                </div>
                <div className="text-2xl font-bold">
                  {longShortRatio !== null ? longShortRatio.toFixed(2) : loading ? '获取中...' : '数据不可用'}
                </div>
                {longShortRatio !== null && (
                  <div className="text-xs text-bloomberg-text-dim mt-1">
                    {longShortRatio > 1 ? '多头占优' : longShortRatio < 1 ? '空头占优' : '多空平衡'} | {longShortRatioPeriod}周期
                  </div>
                )}
                {longShortRatio === null && !loading && (
                  <div className="text-xs text-bloomberg-text-dim mt-1">
                    Binance公开API可能不提供此数据
                  </div>
                )}
              </div>

              <div className="p-4 bg-bloomberg-dark rounded border border-bloomberg-border">
                <div className="text-sm text-bloomberg-text-dim mb-1">恐惧贪婪指数</div>
                <div className={`text-2xl font-bold ${
                  fearGreedIndex !== null && fearGreedIndex > 90 ? 'text-bloomberg-red' :
                  fearGreedIndex !== null && fearGreedIndex < 10 ? 'text-bloomberg-green' :
                  ''
                }`}>
                  {fearGreedIndex !== null ? fearGreedIndex : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* 盘口分析区域 - 紧凑设计 */}
          <div className="bg-bloomberg-darker border border-bloomberg-border rounded-lg p-3 flex flex-col" style={{ height: '600px' }}>
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <h3 className="text-sm font-bold text-bloomberg-text">盘口雷达</h3>
              {orderBookLoading && (
                <span className="text-xs text-bloomberg-text-dim animate-pulse">更新中...</span>
              )}
            </div>
            
            {/* 设置区域 - 单行显示 */}
            <div className="mb-2 flex-shrink-0 flex items-center gap-3 text-xs flex-wrap">
              <div className="flex items-center gap-1">
                <label className="text-bloomberg-text-dim whitespace-nowrap">刷新:</label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="w-16 bg-bloomberg-dark border border-bloomberg-border rounded px-1.5 py-0.5 text-xs text-bloomberg-text focus:outline-none focus:border-bloomberg-blue"
                >
                  <option value="1000">1s</option>
                  <option value="2000">2s</option>
                  <option value="3000">3s</option>
                  <option value="5000">5s</option>
                  <option value="10000">10s</option>
                  <option value="30000">30s</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <label className="text-bloomberg-text-dim whitespace-nowrap">假护/压:</label>
                <input
                  type="number"
                  value={minVolumeForWall}
                  onChange={(e) => setMinVolumeForWall(Number(e.target.value) || 100)}
                  className="w-16 bg-bloomberg-dark border border-bloomberg-border rounded px-1.5 py-0.5 text-xs text-bloomberg-text focus:outline-none focus:border-bloomberg-blue"
                  placeholder="100"
                />
                <span className="text-bloomberg-text-dim text-[10px]">{symbol.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-1">
                <label className="text-bloomberg-text-dim whitespace-nowrap">密集网格:</label>
                <input
                  type="number"
                  value={minAvgVolumeForLadder}
                  onChange={(e) => setMinAvgVolumeForLadder(Number(e.target.value) || 500)}
                  className="w-16 bg-bloomberg-dark border border-bloomberg-border rounded px-1.5 py-0.5 text-xs text-bloomberg-text focus:outline-none focus:border-bloomberg-blue"
                  placeholder="500"
                />
                <span className="text-bloomberg-text-dim text-[10px]">{symbol.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-1">
                <label className="text-bloomberg-text-dim whitespace-nowrap">盘口真空:</label>
                <input
                  type="number"
                  value={maxTotalVolumeForThin}
                  onChange={(e) => setMaxTotalVolumeForThin(Number(e.target.value) || 50)}
                  className="w-16 bg-bloomberg-dark border border-bloomberg-border rounded px-1.5 py-0.5 text-xs text-bloomberg-text focus:outline-none focus:border-bloomberg-blue"
                  placeholder="50"
                />
                <span className="text-bloomberg-text-dim text-[10px]">{symbol.toUpperCase()}</span>
              </div>
            </div>
            
            {/* 滚动区域 - 占满剩余空间 */}
            <div 
              ref={historyScrollRef}
              className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0"
            >
              {orderBookHistory.length > 0 ? (
                orderBookHistory.map((analysis, index) => {
                  const time = new Date(analysis.timestamp);
                  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
                  
                  return (
                    <div
                      key={`${analysis.timestamp}-${index}`}
                      className={`p-2 rounded text-xs border ${
                        analysis.type === 'danger'
                          ? 'bg-red-900/15 border-red-500/30'
                          : analysis.type === 'warning'
                          ? 'bg-yellow-900/15 border-yellow-500/30'
                          : analysis.type === 'success'
                          ? 'bg-green-900/15 border-green-500/30'
                          : 'bg-bloomberg-dark border-bloomberg-border'
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <span className="text-sm">{analysis.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-bloomberg-text text-xs">
                              {analysis.title}
                            </span>
                            <span className="text-[10px] text-bloomberg-text-dim">
                              {timeStr}
                            </span>
                            {analysis.severity === 'high' && (
                              <span className="text-[10px] px-1 py-0.5 bg-red-500/20 text-red-400 rounded">
                                高风险
                              </span>
                            )}
                            {analysis.severity === 'medium' && (
                              <span className="text-[10px] px-1 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                                中风险
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-bloomberg-text-dim mt-0.5">
                            {analysis.description}
                          </div>
                          <div className="text-[10px] text-bloomberg-text-dim mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                            {analysis.price && (
                              <span className="text-bloomberg-blue font-medium">
                                💰 价格: {analysis.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                              </span>
                            )}
                            {analysis.volume && (
                              <span className="text-bloomberg-green">
                                📊 挂单: {analysis.volume.toFixed(2)} {symbol.toUpperCase()}
                              </span>
                            )}
                            {analysis.avgVolume && (
                              <span className="text-bloomberg-text-dim">
                                📈 平均: {analysis.avgVolume.toFixed(2)} {symbol.toUpperCase()}
                              </span>
                            )}
                            {analysis.totalVolume && (
                              <span className="text-bloomberg-blue">
                                📦 总量: {analysis.totalVolume.toFixed(2)} {symbol.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-xs text-bloomberg-text-dim">
                  {orderBookLoading ? '正在分析盘口数据...' : '等待检测信号...'}
                </div>
              )}
            </div>
            
            {/* AI总结区域 */}
            <div className="mt-2 flex-shrink-0 border-t border-bloomberg-border pt-2">
              <div className="text-xs font-medium text-bloomberg-text mb-1 flex items-center gap-1">
                <span>🤖</span>
                <span>AI总结（过去1小时）</span>
              </div>
              {useMemo(() => {
                const summary = generateOrderBookSummary(orderBookHistory, symbol.toUpperCase());
                return (
                  <div className="text-[11px]">
                    <div className={`p-2 rounded border ${
                      summary.riskLevel === 'high'
                        ? 'bg-red-900/10 border-red-500/30'
                        : summary.riskLevel === 'medium'
                        ? 'bg-yellow-900/10 border-yellow-500/30'
                        : 'bg-green-900/10 border-green-500/30'
                    }`}>
                      <div className="text-bloomberg-text mb-1.5 leading-relaxed">{summary.summary}</div>
                      <div className="space-y-0.5">
                        {summary.keyPoints.map((point, idx) => (
                          <div key={idx} className="text-bloomberg-text-dim text-[10px]">
                            {point}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }, [orderBookHistory, symbol])}
            </div>
            
            <div className="mt-2 text-[10px] text-bloomberg-text-dim flex items-center justify-between flex-shrink-0">
              <span>💡 {refreshInterval / 1000}秒自动更新 | 共{orderBookHistory.length}条记录</span>
              {orderBookHistory.length > 0 && (
                <button
                  onClick={() => setOrderBookHistory([])}
                  className="text-bloomberg-text-dim hover:text-bloomberg-text transition-colors"
                >
                  清空历史
                </button>
              )}
            </div>
          </div>

          {/* 代币新闻区域 */}
          <div className="bg-bloomberg-darker border border-bloomberg-border rounded-lg p-4 flex flex-col" style={{ height: '600px' }}>
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h3 className="text-lg font-bold text-bloomberg-text">📰 {symbol.toUpperCase()} 相关新闻</h3>
              {newsLoading && (
                <span className="text-xs text-bloomberg-text-dim animate-pulse">加载中...</span>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
              {news.length > 0 ? (
                news.map((item, index) => {
                  const date = new Date(item.publishedAt);
                  const timeAgo = getTimeAgo(date);
                  
                  return (
                    <div
                      key={index}
                      className="p-3 rounded border bg-bloomberg-dark border-bloomberg-border hover:border-bloomberg-blue transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 flex-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            item.type === 'project'
                              ? 'bg-blue-500/20 text-blue-400'
                              : item.type === 'onchain'
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}>
                            {item.type === 'project' ? '📊 项目' : item.type === 'onchain' ? '🔗 链上' : '📰 媒体'}
                          </span>
                          <span className="text-xs text-bloomberg-text-dim">{item.source}</span>
                        </div>
                        <span className="text-[10px] text-bloomberg-text-dim whitespace-nowrap">{timeAgo}</span>
                      </div>
                      <h4 className="text-sm font-medium text-bloomberg-text mb-1.5 line-clamp-2">
                        {item.title}
                      </h4>
                      {item.description && (
                        <p className="text-xs text-bloomberg-text-dim mb-2 line-clamp-3">
                          {item.description}
                        </p>
                      )}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-bloomberg-blue hover:text-bloomberg-blue/80 inline-flex items-center gap-1"
                        >
                          查看详情 →
                        </a>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-bloomberg-text-dim">
                  {newsLoading ? '正在加载新闻...' : '暂无新闻数据'}
                </div>
              )}
            </div>
            
            <div className="mt-3 text-[10px] text-bloomberg-text-dim flex items-center justify-between flex-shrink-0 border-t border-bloomberg-border pt-2">
              <span>💡 新闻数据每5分钟自动更新</span>
              <button
                onClick={fetchNews}
                className="text-bloomberg-text-dim hover:text-bloomberg-text transition-colors"
              >
                刷新新闻
              </button>
            </div>
          </div>

          {/* 右侧：用户手动输入 */}
          <div className="bg-bloomberg-darker border border-bloomberg-border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">✍️ 手动观察输入</h2>

            <div className="space-y-6">
              {/* ETF资金流向 */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  ETF 资金流向 (亿美元)
                </label>
                
                {/* 币本位转换工具 */}
                {hasETFData(symbol) && price && (
                  <div className="mb-3 p-3 bg-bloomberg-darker border border-bloomberg-border rounded">
                    <div className="text-xs text-bloomberg-text-dim mb-2">
                      💡 Coinglass显示的是币本位数据，可用下方工具转换：
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="block text-xs text-bloomberg-text-dim mb-1">
                          币本位净流入 ({symbol.toUpperCase()})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={etfFlowCoin}
                          onChange={(e) => {
                            const coinValue = parseFloat(e.target.value) || 0;
                            setEtfFlowCoin(coinValue);
                            // 自动转换为美元本位（亿美元）
                            const usdValue = (coinValue * price) / 100000000;
                            setEtfFlow(usdValue);
                          }}
                          className="w-full bg-bloomberg-dark border border-bloomberg-border rounded px-3 py-1.5 text-sm text-bloomberg-text focus:outline-none focus:border-bloomberg-blue"
                          placeholder={`输入${symbol.toUpperCase()}数量`}
                        />
                      </div>
                      <div className="text-xs text-bloomberg-text-dim px-2">
                        × {price.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD
                      </div>
                      <div className="text-xs text-bloomberg-text-dim px-2">
                        =
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-bloomberg-text-dim mb-1">
                          美元本位 (亿美元)
                        </label>
                        <input
                          type="text"
                          value={etfFlow.toFixed(2)}
                          readOnly
                          className="w-full bg-bloomberg-dark border border-bloomberg-border rounded px-3 py-1.5 text-sm text-bloomberg-text opacity-75"
                        />
                      </div>
                    </div>
                    <div className="text-xs text-bloomberg-text-dim mt-2">
                      或直接在下方的美元本位输入框中输入
                    </div>
                  </div>
                )}
                
                <input
                  type="number"
                  step="0.01"
                  value={etfFlow}
                  onChange={(e) => setEtfFlow(parseFloat(e.target.value) || 0)}
                  className="w-full bg-bloomberg-dark border border-bloomberg-border rounded px-4 py-2 text-bloomberg-text focus:outline-none focus:border-bloomberg-blue"
                  placeholder="输入净流入金额（亿美元，正数=流入，负数=流出）"
                />
                <div className="text-xs text-bloomberg-text-dim mt-1 mb-2">
                  &gt; 5亿: +15分 | &gt; 10亿: +30分 | 连续流出 &gt; 3亿: -15分
                </div>
                {hasETFData(symbol) ? (
                  <a
                    href={getETFLink(symbol)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs text-bloomberg-blue hover:text-bloomberg-blue/80 underline transition-colors"
                  >
                    <span>🔗</span>
                    <span>查询 {symbol.toUpperCase()} ETF资金流向数据 (Coinglass) →</span>
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-2 text-xs text-bloomberg-text-dim mt-1">
                    <span>ℹ️</span>
                    <span>{symbol.toUpperCase()} 暂无ETF数据，可访问 <a href="https://www.coinglass.com/etf" target="_blank" rel="noopener noreferrer" className="text-bloomberg-blue hover:underline">Coinglass ETF页面</a> 查看其他代币</span>
                  </div>
                )}
              </div>

              {/* 盘口挂单特征 - 已改为自动分析 */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  盘口挂单特征 (自动分析)
                </label>
                <div className="p-3 bg-bloomberg-dark rounded border border-bloomberg-border">
                  <p className="text-sm text-bloomberg-text-dim mb-2">
                    盘口特征已由"盘口雷达"自动分析并计入评分
                  </p>
                  {(() => {
                    const autoFeatures = extractOrderBookFeatures(orderBookHistory, 60000);
                    return autoFeatures.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs text-bloomberg-text-dim mb-1">当前检测到的特征：</p>
                        {autoFeatures.map((feature) => {
                          const featureLabels: Record<string, string> = {
                            'real-support': '🟢 真护盘 (+10分)',
                            'fake-support': '🔴 假护盘/假压盘 (-5分)',
                            'real-breakout': '🟡 盘口真空/真突破 (+15分)',
                            'fake-support-removed': '🔴 支撑位撤单 (-15分)',
                          };
                          return (
                            <div key={feature} className="text-xs text-bloomberg-text">
                              {featureLabels[feature] || feature}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-bloomberg-text-dim">
                        暂无检测到盘口特征（盘口雷达正在分析中...）
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* 计算按钮 */}
              <button
                onClick={handleCalculate}
                disabled={loading || fundingRate === null || fearGreedIndex === null}
                className="w-full py-3 bg-bloomberg-green text-white rounded-lg font-semibold hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                计算综合得分
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
