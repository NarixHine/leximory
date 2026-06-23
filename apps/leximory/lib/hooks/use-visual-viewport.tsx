import { useEffect, useState } from 'react'

export function useSmoothVisualViewport() {
    const [viewportCoords, setViewportCoords] = useState({ top: 96, scaleWidth: 1 })

    useEffect(() => {
        if (typeof window === 'undefined' || !window.visualViewport) return

        const handleResize = () => {
            const vv = window.visualViewport
            if (!vv) return

            // 96px matches top-24. Add the offset dynamically.
            // Grab the scale to handle virtual zoom pinch behaviors if needed.
            setViewportCoords({
                top: vv.offsetTop + 96,
                scaleWidth: vv.width,
            })
        }

        // iOS triggers scroll and resize events rapidly while the keyboard opens
        window.visualViewport.addEventListener('resize', handleResize)
        window.visualViewport.addEventListener('scroll', handleResize)

        handleResize()

        return () => {
            window.visualViewport?.removeEventListener('resize', handleResize)
            window.visualViewport?.removeEventListener('scroll', handleResize)
        }
    }, [])

    return viewportCoords
}
