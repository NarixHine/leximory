'use server'

import { listLibs } from '@/server/db/lib'
import { aggrMonthlyWordHistogram } from '@/server/db/word'

export async function getData(uid: string) {
    const libs = await listLibs({ owner: uid })
    const results = await aggrMonthlyWordHistogram({ libs })
    return results
}
