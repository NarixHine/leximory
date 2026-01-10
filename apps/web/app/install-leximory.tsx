'use client'

import dynamic from 'next/dynamic'

const PWAPrompt = dynamic(() => import('react-ios-pwa-prompt'), { ssr: false })

export default function InstallLeximory() {
    return <PWAPrompt copyTitle='将 Leximory 添加到主屏幕' copyDescription='在主屏幕上快速访问 Leximory PWA' copySubtitle='https://leximory.com/' copyShareStep='点击右上角分享按钮' copyAddToHomeScreenStep='点击"添加到主屏幕"' appIconPath='/apple-touch-icon.png' />
}
