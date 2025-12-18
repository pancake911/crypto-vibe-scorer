import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Crypto Vibe Scorer - 代币打分系统',
  description: '加密货币量化交易辅助决策仪表盘',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-bloomberg-dark">{children}</body>
    </html>
  )
}
