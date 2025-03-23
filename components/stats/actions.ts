'use server'

import { listLibs } from '@/server/db/lib'
import { aggrWordHistogram } from '@/server/db/word'

export async function getData(uid: string) {
    const libs = await listLibs({ owner: uid })
    const results = await aggrWordHistogram({ libs, size: 30 })
    return results
}
