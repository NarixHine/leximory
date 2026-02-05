import { getDictation } from '@repo/supabase/dictation'
import { DictationContent } from './dictation-content'
import { Kilpi } from '@repo/service/kilpi'
import { getPaper } from '@repo/supabase/paper'

type DictationProps = {
    paperId: number
}

export default async function Dictation({ paperId }: DictationProps) {
    const [dictation, { granted }] = await Promise.all([
        getDictation({ paperId }),
        Kilpi.papers.update(await getPaper({ id: paperId })).authorize(),
    ])

    return (
        <DictationContent
            paperId={paperId}
            dictation={dictation}
            hasWriteAccess={granted}
        />
    )
}
