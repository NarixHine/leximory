import { useEffect, useState } from 'react'

export function useVisualViewport() {
    const [viewportStyle, setViewportStyle] = useState<React.CSSProperties>({})

    useEffect(() => {
        if (typeof window === 'undefined' || !window.visualViewport) return

        const handleResize = () => {
            const vv = window.visualViewport
            if (!vv) return

            // Calculate offset if the viewport has shifted due to the keyboard
            // We pin it relative to the top of the *visual* viewport
            setViewportStyle({
                position: 'absolute',
                top: `${vv.offsetTop + 96}px`, // 96px matches your 'top-24' spacing
                left: `${vv.offsetLeft + vv.width / 2}px`,
                transform: 'translateX(-50%)',
                width: `${vv.width}px`, // Ensures it scales properly to the visible space
            })
        }

        window.visualViewport.addEventListener('resize', handleResize)
        window.visualViewport.addEventListener('scroll', handleResize)

        // Initial call
        handleResize()

        return () => {
            window.visualViewport?.removeEventListener('resize', handleResize)
            window.visualViewport?.removeEventListener('scroll', handleResize)
        }
    }, [])

    return viewportStyle
}
