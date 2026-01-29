import momentTz from 'moment-timezone'
import 'moment/locale/en-gb'

export const momentSH = (inp?: momentTz.MomentInput) => momentTz(inp).locale('en-gb').tz('Asia/Shanghai')
