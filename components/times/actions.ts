'use server'

import { getLatestTimesData, getRecentTimesData, getTimesDataByDate } from '@/server/db/times'

export async function fetchLatestIssue() {
    return getLatestTimesData()
}

export async function fetchIssue(date: string) {
    return getTimesDataByDate(date)
}

export async function fetchMoreIssues(page: number) {
    return getRecentTimesData(page)
}
