'use server'

import { listLibs } from '@/server/lib'
import { aggrMonthlyWordHistogram } from '@/server/word'

export async function getData(uid: string) {
    const libs = await listLibs({ owner: uid })
    const results = await aggrMonthlyWordHistogram({ libs })
    return results
}
