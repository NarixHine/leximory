'use client'

import { useEffect } from 'react'

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

export const useIsIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase()
    return /iphone|ipad|ipod|macintosh|safari/.test(userAgent)
}
