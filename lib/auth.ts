import { getXataClient } from '@/lib/xata'
import { auth } from '@clerk/nextjs/server'
import { libAccessStatusMap } from './config'

const getAuthOrThrow = async () => {
    const xata = getXataClient()
    const { userId, orgId, orgRole } = await auth()
    if (!userId) {
        throw new Error('Unauthorized')
    }
    return { xata, userId, orgId, orgRole }
}

// auth access to libs

export const authWriteToLib = async (lib: string, explicitUserId?: string) => {
    const { xata, userId, orgId, orgRole } = explicitUserId ? { userId: explicitUserId, orgId: undefined, orgRole: undefined, xata: getXataClient() } : await getAuthOrThrow()
    const rec = await xata.db.libraries.select(['lang']).filter({
        $all: [
            { id: lib },
            { $any: [{ owner: userId }, ...(orgId && orgRole === 'org:admin' ? [{ org: orgId }] : [])] },
        ]
    }).getFirstOrThrow()
    return rec
}

export const authReadToLib = async (lib: string) => {
    const { xata, userId, orgId, orgRole } = await getAuthOrThrow()
    const rec = await xata.db.libraries.select(['owner', 'lang', 'name', 'starredBy', 'org']).filter({
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

    const isReadOnly = rec.owner !== (await auth()).userId && (!orgId || orgRole !== 'org:admin')
    const isOwner = rec.owner === (await auth()).userId
    const { lang } = rec
    const isOrganizational = !!orgId && rec.org === orgId
    return { rec, isReadOnly, isOwner, lang, isOrganizational }
}

// auth access to items related to libs

export const authWriteToText = async (text: string) => {
    const { xata, userId, orgId, orgRole } = await getAuthOrThrow()
    const rec = await xata.db.texts.filter({
        $all: [
            { id: text },
            { $any: [{ 'lib.owner': userId }, ...(orgId && orgRole === 'org:admin' ? [{ 'lib.org': orgId }] : [])] },
        ]
    }).getFirstOrThrow()
    return rec
}

export const authReadToText = async (text: string) => {
    const { xata, userId, orgId } = await getAuthOrThrow()
    const rec = await xata.db.texts.select([]).filter({
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
    return rec
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
                $notExists: 'lib.org'
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

export const isAccessibleAndRelevantToUser = async () => {
    return {
        $any: [
            await isOwnedByUser(),
            await isAccessibleToUserOnly(),
            await isAccessibleToUserOrg(),
        ]
    }
}
