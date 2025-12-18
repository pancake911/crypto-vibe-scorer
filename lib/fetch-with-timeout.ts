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
    const response = await fetch(url, {
      ...fetchOptions,
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

