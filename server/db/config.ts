import { get } from '@vercel/edge-config'
import { z } from 'zod'

const zNotice = z.object({
    message: z.string(),
    date: z.string(),
})

export const zNotices = z.array(zNotice)
export const getNotices = async () => {
    const notices = await get('notices')
    if (typeof notices === 'string') return zNotices.parse(JSON.parse(notices))
    return []
}
