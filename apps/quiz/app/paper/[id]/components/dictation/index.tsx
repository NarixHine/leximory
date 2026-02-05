import { getDictation } from '@repo/supabase/dictation'
import { getPaper } from '@repo/supabase/paper'
import { getUser } from '@repo/user'
import { DictationContent } from './dictation-content'

type DictationProps = {
    paperId: number
}

export default async function Dictation({ paperId }: DictationProps) {
    const [dictation, paper, user] = await Promise.all([
        getDictation({ paperId }),
        getPaper({ id: paperId }),
        getUser(),
    ])
    
    const isOwner = user?.userId === paper.creator
    
    return (
        <DictationContent 
            paperId={paperId}
            dictation={dictation}
            isOwner={isOwner}
        />
    )
}
