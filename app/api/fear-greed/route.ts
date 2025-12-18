import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://api.alternative.me/fng/', {
      next: { revalidate: 300 }, // 缓存5分钟
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch fear and greed index');
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      data: {
        value: parseInt(data.data[0].value),
        classification: data.data[0].value_classification,
        timestamp: parseInt(data.data[0].timestamp),
      },
    });
  } catch (error: any) {
    console.error('Fear & Greed API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取恐惧贪婪指数失败',
      },
      { status: 500 }
    );
  }
}
