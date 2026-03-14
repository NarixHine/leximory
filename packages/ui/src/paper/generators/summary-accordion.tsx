'use client'

import { useAtomValue } from 'jotai'
import { viewModeAtom } from '../atoms'
import { Accordion } from '../../accordion'
import { safeParseHTML } from '../../utils/parse'

export default function SummaryAccordion({ text }: { text: string }) {
    const viewMode = useAtomValue(viewModeAtom)
    return (
        <Accordion
            defaultExpandedKeys={viewMode === 'normal' ? ['summary-text'] : []}
            itemKey='summary-text'
            itemProps={{ title: '概要原文', className: 'print:hidden -ml-2 -mr-2 -mb-2', classNames: { content: 'pt-0' } }}
        >
            <>{safeParseHTML(text)}</>
        </Accordion>
    )
}
