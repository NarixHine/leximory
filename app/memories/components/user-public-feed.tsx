'use client'

import { getPublicMemoriesAction } from '../actions'
import { FeedBase } from './feed-base'

interface UserPublicFeedProps {
    userId: string
}

export function UserPublicFeed({ userId }: UserPublicFeedProps) {
    return (
        <FeedBase
            queryKey={['user-public-memories', userId]}
            fetchMemories={({ pageParam }) => getPublicMemoriesAction({ userId, page: pageParam, size: 10 })}
        />
    )
}