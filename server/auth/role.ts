import { getXataClient } from '@/server/client/xata'
import { auth } from '@clerk/nextjs/server'
import { Lang, libAccessStatusMap } from '../../lib/config'
import { redirect } from 'next/navigation'

const xata = getXataClient()

export const getAuthOrThrow = async () => {
    const { userId, orgId, orgRole } = await auth()
    if (!userId) {
        redirect('/sign-in')
    }
    return { userId, orgId, orgRole }
}

// auth access to libs

export const authWriteToLib = async (lib: string, explicitUserId?: string) => {
    const { userId, orgId, orgRole } = explicitUserId ? { userId: explicitUserId, orgId: undefined, orgRole: undefined } : await getAuthOrThrow()
    const rec = await xata.db.libraries.select(['lang']).filter({
        $all: [
            { id: lib },
            { $any: [{ owner: userId }, ...(orgId && orgRole === 'org:admin' ? [{ org: orgId }] : [])] },
        ]
    }).getFirstOrThrow()
    return { lang: rec.lang as Lang }
}

export const authReadToLib = async (lib: string) => {
    const { userId, orgId, orgRole } = await getAuthOrThrow()
    const rec = await xata.db.libraries.select(['owner', 'lang', 'name', 'starredBy', 'org', 'price']).filter({
        $all: [
            { id: lib },
            {
                $any: [
                    { owner: userId },
                    ...(orgId ? [{ org: orgId }] : []),
                    { access: libAccessStatusMap.public }
                ]
            },
        ]
    }).getFirstOrThrow()

    const isReadOnly = rec.owner !== (await auth()).userId && (!orgId || orgId !== rec.org || orgRole !== 'org:admin')
    const isOwner = rec.owner === (await auth()).userId
    const { lang } = rec
    const isOrganizational = !!orgId && rec.org === orgId
    return { isReadOnly, isOwner, owner: rec.owner, lang: lang as Lang, isOrganizational, name: rec.name, starredBy: rec.starredBy, price: rec.price }
}

// auth access to items related to libs

export const authWriteToText = async (text: string) => {
    const { userId, orgId, orgRole } = await getAuthOrThrow()
    const rec = await xata.db.texts.filter({
        $all: [
            { id: text },
            { $any: [{ 'lib.owner': userId }, ...(orgId && orgRole === 'org:admin' ? [{ 'lib.org': orgId }] : [])] },
        ]
    }).getFirstOrThrow()
    return rec
}

export const authReadToText = async (text: string) => {
    const { userId, orgId } = await getAuthOrThrow()
    await xata.db.texts.select([]).filter({
        $all: [
            { id: text },
            {
                $any: [
                    { 'lib.owner': userId },
                    ...(orgId ? [{ 'lib.org': orgId }] : []),
                    { 'lib.access': libAccessStatusMap.public }
                ]
            },
        ]
    }).getFirstOrThrow()
}

const isPublic = { 'lib.access': libAccessStatusMap.public }

const isStarredByUser = async () => {
    const { userId } = await getAuthOrThrow()
    return { 'lib.starredBy': { $includes: userId } }
}

const isOwnedByUser = async () => {
    const { userId } = await getAuthOrThrow()
    return { 'lib.owner': userId }
}

const isAccessibleToUserOnly = async () => {
    return {
        $any: [
            {
                ...(await isOwnedByUser()),
                $notExists: 'lib.org',
            },
            {
                $all: [
                    await isStarredByUser(),
                    isPublic
                ]
            }
        ]
    }
}

export const isAccessibleToUserOrg = async () => {
    const { orgId } = await getAuthOrThrow()
    return orgId ? {
        'lib.org': orgId,
    } : {}
}

export const isListed = async () => {
    const { orgId } = await getAuthOrThrow()
    return orgId ? isAccessibleToUserOrg() : isAccessibleToUserOnly()
}
