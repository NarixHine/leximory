'use server'

import { prefixUrl } from '@/lib/config'
import { getArticleData } from '../data'

export async function getPublicShareLink(textId: string) {
    const { isPublicAndFree } = await getArticleData(textId, false)

    if (isPublicAndFree) {
        const url = prefixUrl(`/read/${textId}`)
        return url
    }

    throw new Error('This library is not public or free, so a public link cannot be generated.')
}     
