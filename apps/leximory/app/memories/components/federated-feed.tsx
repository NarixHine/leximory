'use client'

import { getFederatedMemoriesAction } from '../actions'
import { FeedBase } from './feed-base'

export function FederatedFeed() {
    return (
        <FeedBase
            queryKey={['federated-memories']}
            fetchMemories={({ pageParam }) => getFederatedMemoriesAction({ page: pageParam, size: 10 })}
        />
    )
}