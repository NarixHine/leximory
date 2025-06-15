'use server'

import { getTimesDataByDate } from '@/server/db/times'

export async function fetchIssue(date: string) {
    return getTimesDataByDate(date)
}
