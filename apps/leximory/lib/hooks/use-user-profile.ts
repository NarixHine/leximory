'use client'

import { useQuery } from '@tanstack/react-query'
import { getUserProfileAction } from '@repo/service/user'

/** Fetches user profile data (name, image) via TanStack Query with infinite stale time. */
export function useUserProfile(uid: string) {
    return useQuery({
        queryKey: ['user', uid],
        queryFn: async () => {
            const { data } = await getUserProfileAction({ id: uid })
            return data
        },
        staleTime: Infinity,
    })
}
