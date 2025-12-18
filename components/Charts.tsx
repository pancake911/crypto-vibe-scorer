'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface ChartData {
  time: string;
  timestamp: number;
  value: number;
}

interface ChartsProps {
  fundingRateHistory?: ChartData[];
  longShortRatioHistory?: ChartData[];
  priceHistory?: ChartData[];
}

export function Charts({ fundingRateHistory = [], longShortRatioHistory = [], priceHistory = [] }: ChartsProps) {
  // 只显示最近10个数据点
  const displayFundingRate = fundingRateHistory.slice(-10);
  const displayLongShortRatio = longShortRatioHistory.slice(-10);
  const displayPrice = priceHistory.slice(-10);
  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 资金费率趋势图 */}
        {displayFundingRate.length > 0 && (
          <div className="bg-bloomberg-darker border border-bloomberg-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-bloomberg-text">资金费率趋势</h3>
              <span className="text-xs text-bloomberg-text-dim">({displayFundingRate.length}/10个数据点)</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={displayFundingRate}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis 
                dataKey="time" 
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
              />
              <YAxis 
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
                label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#888' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1a1a', 
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#00ff88" 
                fill="#00ff8820"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        )}

        {/* 多空比趋势图 */}
        {displayLongShortRatio.length > 0 && (
          <div className="bg-bloomberg-darker border border-bloomberg-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-bloomberg-text">多空持仓比趋势</h3>
              <span className="text-xs text-bloomberg-text-dim">({displayLongShortRatio.length}/10个数据点)</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={displayLongShortRatio}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis 
                dataKey="time" 
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
              />
              <YAxis 
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1a1a', 
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#ffaa00" 
                strokeWidth={2}
                dot={{ fill: '#ffaa00', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        )}

        {/* 价格趋势图 */}
        {displayPrice.length > 0 && (
          <div className="bg-bloomberg-darker border border-bloomberg-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-bloomberg-text">价格趋势</h3>
              <span className="text-xs text-bloomberg-text-dim">({displayPrice.length}/10个数据点)</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={displayPrice}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis 
                dataKey="time" 
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
              />
              <YAxis 
                stroke="#888"
                tick={{ fill: '#888', fontSize: 10 }}
                label={{ value: 'USD', angle: -90, position: 'insideLeft', fill: '#888' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1a1a', 
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff'
                }}
                formatter={(value: number) => `$${value.toLocaleString()}`}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#0088ff" 
                fill="#0088ff20"
                strokeWidth={2}
              />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

