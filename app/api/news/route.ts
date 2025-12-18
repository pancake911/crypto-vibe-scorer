import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  type: 'project' | 'media' | 'onchain';
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol') || 'BTC';
    const limit = parseInt(searchParams.get('limit') || '10');

    const newsItems: NewsItem[] = [];

    // 1. 从CoinGecko获取新闻（权威媒体报道）
    try {
      const coinId = getCoinGeckoId(symbol);
      if (coinId) {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}/news?per_page=${limit}`,
          {
            next: { revalidate: 300 }, // 缓存5分钟
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data)) {
            data.forEach((item: any) => {
              newsItems.push({
                title: item.title || '',
                description: item.description || item.snippet || '',
                url: item.url || item.link || '',
                source: item.source || 'CoinGecko',
                publishedAt: item.published_on || new Date().toISOString(),
                type: 'media',
              });
            });
          }
        }
      }
    } catch (e: any) {
      console.log('CoinGecko新闻获取失败:', e.message);
    }

    // 2. 从CryptoCompare获取新闻
    try {
      const response = await fetch(
        `https://min-api.cryptocompare.com/data/v2/news/?categories=${symbol}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Apikey ${process.env.CRYPTOCOMPARE_API_KEY || 'demo'}`,
          },
          next: { revalidate: 300 },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.Data && Array.isArray(data.Data)) {
          data.Data.forEach((item: any) => {
            newsItems.push({
              title: item.title || '',
              description: item.body || item.description || '',
              url: item.url || item.guid || '',
              source: item.source || 'CryptoCompare',
              publishedAt: new Date(item.published_on * 1000).toISOString(),
              type: 'media',
            });
          });
        }
      }
    } catch (e: any) {
      console.log('CryptoCompare新闻获取失败:', e.message);
    }

    // 2.5. 获取Twitter链上追踪数据（优先获取Lookonchain，然后EmberCN）
    try {
      const twitterData = await fetchTwitterOnchainData(symbol);
      // Lookonchain的推文会优先添加到数组前面（置顶）
      const lookonchainTweets = twitterData.filter(item => item.source === '链上数据');
      const otherTweets = twitterData.filter(item => item.source !== '链上数据');
      
      // 先添加Lookonchain（置顶），再添加其他的
      lookonchainTweets.forEach((item) => {
        newsItems.push(item);
      });
      otherTweets.forEach((item) => {
        newsItems.push(item);
      });
    } catch (e: any) {
      console.log('Twitter数据获取失败:', e.message);
    }

    // 3. 链上追踪数据源（区块链浏览器链接）
    if (symbol.toUpperCase() === 'BTC' || symbol.toUpperCase() === 'ETH' || symbol.toUpperCase() === 'SOL') {
      // 添加区块链浏览器链接
      newsItems.push({
        title: `🔗 ${symbol} 链上数据追踪 - 区块链浏览器`,
        description: `查看 ${symbol} 的链上大额转账、巨鲸动向、交易所流入流出等数据，建议访问区块链浏览器查看实时链上活动。`,
        url: getBlockExplorerUrl(symbol),
        source: '区块链浏览器',
        publishedAt: new Date().toISOString(),
        type: 'onchain',
      });
    }

    // 4. 项目进展信息（从CoinGecko获取项目信息）
    try {
      const coinId = getCoinGeckoId(symbol);
      if (coinId) {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=true&developer_data=true&sparkline=false`,
          {
            next: { revalidate: 3600 }, // 缓存1小时
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.community_data || data.developer_data) {
            // 添加项目社区和开发数据作为"项目进展"
            if (data.community_data) {
              const githubStars = data.community_data.github_stars || 0;
              const twitterFollowers = data.community_data.twitter_followers || 0;
              const redditSubscribers = data.community_data.reddit_subscribers || 0;
              
              // 只在有实际数据时显示
              if (githubStars > 0 || twitterFollowers > 0 || redditSubscribers > 0) {
                newsItems.push({
                  title: `📊 ${symbol} 社区数据`,
                  description: `GitHub关注: ${githubStars > 0 ? githubStars.toLocaleString() : 'N/A'}, Twitter关注: ${twitterFollowers > 0 ? twitterFollowers.toLocaleString() : 'N/A'}, Reddit订阅: ${redditSubscribers > 0 ? redditSubscribers.toLocaleString() : 'N/A'}`,
                  url: `https://www.coingecko.com/zh/coins/${coinId}`,
                  source: 'CoinGecko',
                  publishedAt: new Date().toISOString(),
                  type: 'project',
                });
              }
            }
          }
        }
      }
    } catch (e: any) {
      console.log('项目数据获取失败:', e.message);
    }

    // 排序：Lookonchain的链上数据置顶，然后按时间排序
    newsItems.sort((a, b) => {
      // Lookonchain的链上数据始终置顶
      const aIsLookonchain = a.source === '链上数据';
      const bIsLookonchain = b.source === '链上数据';
      
      if (aIsLookonchain && !bIsLookonchain) return -1;
      if (!aIsLookonchain && bIsLookonchain) return 1;
      
      // 其他按时间排序
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    // 限制返回数量
    const limitedNews = newsItems.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        news: limitedNews,
        count: limitedNews.length,
      },
    });
  } catch (error: any) {
    console.error('News API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取新闻失败',
      },
      { status: 500 }
    );
  }
}

// 获取CoinGecko的币种ID
function getCoinGeckoId(symbol: string): string | null {
  const symbolMap: Record<string, string> = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'BNB': 'binancecoin',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'DOGE': 'dogecoin',
    'AVAX': 'avalanche-2',
    'MATIC': 'matic-network',
    'DOT': 'polkadot',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'ATOM': 'cosmos',
  };
  return symbolMap[symbol.toUpperCase()] || null;
}

// 获取区块链浏览器URL
function getBlockExplorerUrl(symbol: string): string {
  const symbolUpper = symbol.toUpperCase();
  if (symbolUpper === 'BTC') {
    return 'https://www.blockchain.com/explorer';
  } else if (symbolUpper === 'ETH') {
    return 'https://etherscan.io';
  } else if (symbolUpper === 'SOL') {
    return 'https://solscan.io';
  } else if (symbolUpper === 'BNB') {
    return 'https://bscscan.com';
  } else if (symbolUpper === 'AVAX') {
    return 'https://snowtrace.io';
  } else if (symbolUpper === 'MATIC') {
    return 'https://polygonscan.com';
  }
  return 'https://www.coingecko.com';
}

// 获取Twitter链上追踪数据
async function fetchTwitterOnchainData(symbol: string): Promise<NewsItem[]> {
  const symbolUpper = symbol.toUpperCase();
  const items: NewsItem[] = [];

  // Twitter账号列表
  const twitterAccounts = [
    { username: 'EmberCN', name: 'EmberCN' },
    { username: 'lookonchain', name: 'Lookonchain' },
  ];

  for (const account of twitterAccounts) {
    try {
      // 尝试多个Nitter实例（Twitter的替代前端，提供RSS）
      const nitterInstances = [
        'https://nitter.net',
        'https://nitter.pussthecat.org',
        'https://nitter.42l.fr',
        'https://nitter.unixfox.eu',
        'https://nitter.privacydev.net',
      ];

      let foundTweet = false;

      for (const baseUrl of nitterInstances) {
        if (foundTweet) break;

        try {
          const rssUrl = `${baseUrl}/${account.username}/rss`;
          const response = await fetch(rssUrl, {
            next: { revalidate: 180 }, // 缓存3分钟
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: AbortSignal.timeout(5000), // 5秒超时
          });

          if (response.ok) {
            const rssText = await response.text();
            
            // 检查是否包含代币名称
            const symbolRegex = new RegExp(`\\b${symbolUpper}\\b`, 'i');
            
            if (symbolRegex.test(rssText)) {
              // 解析RSS，提取所有item
              const itemRegex = /<item>([\s\S]*?)<\/item>/g;
              let match;

              while ((match = itemRegex.exec(rssText)) !== null && !foundTweet) {
                const itemContent = match[1];
                
                // 检查是否包含代币名称
                if (symbolRegex.test(itemContent)) {
                  const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
                  const linkMatch = itemContent.match(/<link>(.*?)<\/link>/);
                  const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
                  const descriptionMatch = itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/);
                  
                  if (titleMatch && linkMatch) {
                    // 提取推文内容 - 优先使用description（包含完整推文）
                    let tweetText = '';
                    
                    // 先尝试从description提取
                    if (descriptionMatch) {
                      let rawText = (descriptionMatch[1] || descriptionMatch[2] || '').trim();
                      
                      // 移除HTML标签
                      rawText = rawText.replace(/<[^>]*>/g, ' ');
                      
                      // 解码HTML实体
                      tweetText = rawText
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/&apos;/g, "'")
                        .replace(/\s+/g, ' ')
                        .trim();
                    }
                    
                    // 如果description为空或太短，使用title
                    if (!tweetText || tweetText.length < 10) {
                      if (titleMatch) {
                        tweetText = (titleMatch[1] || titleMatch[2] || '').trim();
                        // 移除可能的账号名前缀（如 "EmberCN: "）
                        tweetText = tweetText.replace(/^[^:]+:\s*/, '');
                      }
                    }
                    
                    const link = linkMatch[1].trim();
                    // 将Nitter链接转换为Twitter链接
                    let twitterLink = link;
                    if (link.includes('nitter')) {
                      // 提取推文ID
                      const tweetIdMatch = link.match(/\/(\d+)$/);
                      if (tweetIdMatch) {
                        twitterLink = `https://x.com/${account.username}/status/${tweetIdMatch[1]}`;
                      } else {
                        twitterLink = `https://x.com/${account.username}`;
                      }
                    }
                    
                    const pubDate = pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString();
                    
                    // 确保推文内容包含代币名称且长度合理（过滤掉不相关的推文）
                    if (symbolRegex.test(tweetText) && tweetText.length > 15) {
                      // 使用推文内容作为标题和描述
                      // Lookonchain使用特殊标签"链上数据"
                      const sourceLabel = account.name === 'Lookonchain' 
                        ? '链上数据' 
                        : `${account.name} (Twitter)`;
                      
                      items.push({
                        title: `🔗 ${account.name} - ${symbolUpper} 链上追踪`,
                        description: tweetText.substring(0, 600), // 显示完整推文内容（最多600字符）
                        url: twitterLink,
                        source: sourceLabel,
                        publishedAt: pubDate,
                        type: 'onchain',
                      });
                      foundTweet = true; // 找到一条就退出
                    }
                  }
                }
              }
            }
          }
        } catch (e: any) {
          // 继续尝试下一个实例
          continue;
        }
      }
    } catch (e: any) {
      console.log(`${account.name} RSS获取失败:`, e.message);
    }
  }

  return items;
}
