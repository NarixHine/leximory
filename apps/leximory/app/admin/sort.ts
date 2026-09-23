import type { AdminUser } from './data-fetching'

export type SortKey = 'username' | 'plan' | 'status' | 'createdAt' | 'lastSignInAt'
export type SortDirection = 'ascending' | 'descending'

export interface SortRule {
    column: SortKey
    direction: SortDirection
}

function toTime(value: string | null) {
    return value ? new Date(value).getTime() : 0
}

function compareText(a: string, b: string) {
    const left = a.toLowerCase()
    const right = b.toLowerCase()
    return left < right ? -1 : left > right ? 1 : 0
}

export const SORT_FIELDS: Record<
    SortKey,
    { label: string; compare: (a: AdminUser, b: AdminUser) => number }
> = {
    username: { label: 'User', compare: (a, b) => compareText(a.username, b.username) },
    plan: { label: 'Plan', compare: (a, b) => compareText(a.plan, b.plan) },
    status: {
        label: 'Status',
        compare: (a, b) => Number(Boolean(a.emailConfirmedAt)) - Number(Boolean(b.emailConfirmedAt)),
    },
    createdAt: { label: 'Joined', compare: (a, b) => toTime(a.createdAt) - toTime(b.createdAt) },
    lastSignInAt: {
        label: 'Last seen',
        compare: (a, b) => toTime(a.lastSignInAt) - toTime(b.lastSignInAt),
    },
}

export const SORT_KEYS = Object.keys(SORT_FIELDS) as SortKey[]

export const DEFAULT_SORT: SortRule[] = [{ column: 'createdAt', direction: 'descending' }]

export function isDefaultSort(rules: SortRule[]) {
    return (
        rules.length === 1 &&
        rules[0].column === 'createdAt' &&
        rules[0].direction === 'descending'
    )
}

/** Stable multi-key sort: earlier rules take priority, later rules break ties. */
export function sortUsers(users: AdminUser[], rules: SortRule[]) {
    const list = [...users]

    list.sort((a, b) => {
        for (const rule of rules) {
            const result = SORT_FIELDS[rule.column].compare(a, b)
            if (result !== 0) {
                return rule.direction === 'ascending' ? result : -result
            }
        }
        return 0
    })

    return list
}
