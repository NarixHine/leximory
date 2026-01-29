import { DateTime } from 'luxon'

export const luxon = (inp?: Date) => (inp ? DateTime.fromJSDate(inp) : DateTime.now()).setLocale('en-gb').setZone('Asia/Shanghai')
