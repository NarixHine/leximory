'use client'

import { getPersonalMemoriesAction } from '../actions'
import { FeedBase } from './feed-base'

export function PersonalFeed() {
    return (
        <FeedBase
            queryKey={['personal-memories']}
            fetchMemories={({ pageParam }) => getPersonalMemoriesAction({ page: pageParam, size: 10 })}
        />
    )
}
