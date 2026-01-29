'use client'

import { QuizItems } from '@repo/schema/paper'
import { Paper } from '@repo/ui/paper'
import { useAtomValue } from 'jotai'
import { highlightsAtom } from '@repo/ui/paper/atoms'

export default function HighlightedPaper({ data }: {
    data: QuizItems
}) {
    const highlights = useAtomValue(highlightsAtom)
    return (
        <Paper data={data} highlights={highlights} />
    )
}
