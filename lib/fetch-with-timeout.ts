// 带超时的fetch工具函数（Edge Runtime兼容）
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = 5000, ...fetchOptions } = options; // 默认5秒超时

  const controller = new AbortController();
  
  // Edge Runtime支持setTimeout
  const timeoutId = typeof setTimeout !== 'undefined' 
    ? setTimeout(() => controller.abort(), timeout)
    : null;

  try {
    // 添加请求头，模拟浏览器请求，避免被Binance API限制
    const headers = new Headers(fetchOptions.headers);
    if (!headers.has('User-Agent')) {
      headers.set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
    if (timeoutId && typeof clearTimeout !== 'undefined') {
      clearTimeout(timeoutId);
    }
    return response;
  } catch (error: any) {
    if (timeoutId && typeof clearTimeout !== 'undefined') {
      clearTimeout(timeoutId);
    }
    if (error.name === 'AbortError') {
      throw new Error(`请求超时 (${timeout}ms): ${url}`);
    }
    throw error;
  }
}

