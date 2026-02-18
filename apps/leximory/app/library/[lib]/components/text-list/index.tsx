'use client'

import { useQuery } from '@tanstack/react-query'
import { getVisitedTextsAction } from '../text/actions'
import Text, { AddTextButton } from '../text'
import { useAtomValue } from 'jotai'
import { libAtom } from '../../atoms'
import { useAction } from '@repo/service'

type TextData = {
    id: string
    title: string
    topics: string[]
    hasEbook: boolean
    createdAt: string
}

export default function TextList({ texts, isReadOnly }: { texts: TextData[], isReadOnly: boolean }) {
    const lib = useAtomValue(libAtom)
    const { execute: loadVisited } = useAction(getVisitedTextsAction)
    const { data: visited } = useQuery({
        queryKey: ['visited', lib],
        queryFn: async () => {
            const result = await loadVisited({ libId: lib })
            if (result?.data) return result.data
            throw new Error(result?.serverError ?? '加载失败')
        },
    })

    return (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {!isReadOnly && <AddTextButton />}
            {texts.map(({ title, id, topics, hasEbook, createdAt }) => (
                <Text
                    id={id}
                    key={id}
                    title={title}
                    topics={topics ?? []}
                    hasEbook={hasEbook}
                    createdAt={createdAt}
                    visitStatus={
                        hasEbook
                            ? undefined
                            : visited ? (visited.includes(id) ? 'visited' : 'not-visited') : 'loading'
                    }
                />
            ))}
        </div>
    )
}
