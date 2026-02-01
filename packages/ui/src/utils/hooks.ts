'use client'

export function useSelectionPosition(selection: Selection | null) {
    // 1. Get the bounding rectangle of the selection
    const rect = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).getBoundingClientRect() : null

    // 2. Calculate positioning
    let buttonTop = 0
    if (rect) {
        const centerY = rect.top + rect.height / 2
        const isUpperHalf = centerY < window.innerHeight / 2
        const scrollOffset = window.scrollY

        if (isUpperHalf) {
            // Position ABOVE the selection
            // rect.top is the top of the text, subtract ~50px for button height + margin
            buttonTop = scrollOffset + rect.top - 50
        } else {
            // Position BELOW the selection
            // rect.bottom is the bottom of the text, add ~10px margin
            buttonTop = scrollOffset + rect.bottom + 10
        }
    }

    return { buttonTop, rect }
}
