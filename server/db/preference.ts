import 'server-only'

import { getXataClient } from '../client/xata'

const xata = getXataClient()

export type Accent = 'BrE' | 'AmE'

export async function setAccentPreference({ accent, userId }: { accent: Accent, userId: string }) {
    await xata.db.users.update({ id: userId, accent: accent })
}

export async function getAccentPreference({ userId }: { userId: string }) {
    const user = await xata.db.users.select(['accent']).filter({ id: userId }).getFirst()
    if (!user) {
        const { accent } = await xata.db.users.create({ id: userId })
        return accent as Accent
    }
    return user.accent as Accent
}
