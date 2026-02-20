import momentTz from 'moment-timezone'

export const momentSH = (inp?: momentTz.MomentInput) => momentTz(inp).tz('Asia/Shanghai')
