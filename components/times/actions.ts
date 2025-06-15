'use server'

import { getRecentTimesData, getTimesDataByDate } from '@/server/db/times'

export async function fetchIssue(date: string) {
    return getTimesDataByDate(date)
}

export async function fetchMoreIssues(page: number) {
    return getRecentTimesData(page)
}
