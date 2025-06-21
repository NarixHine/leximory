'use client'

import { useEffect } from 'react'

export const useIsMobileIos = () => {
    const { navigator } = globalThis
    if (!navigator)
        return false
    const userAgent = navigator.userAgent.toLowerCase()
    return /iphone|ipad|ipod|macintosh|safari/.test(userAgent) && !/chrome/.test(userAgent) && !/android/.test(userAgent)
}

export const useOnWindowResize = (handler: { (): void }) => {
    useEffect(() => {
        const handleResize = () => {
            handler()
        }
        handleResize()
        window.addEventListener("resize", handleResize)

        return () => window.removeEventListener("resize", handleResize)
    }, [handler])
}
