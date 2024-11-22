import { getXataClient } from '@/lib/xata'
import { auth } from '@clerk/nextjs/server'
import { libAccessStatusMap } from './config'

const getAuthOrThrow = () => {
    const xata = getXataClient()
    const { userId, orgId, orgRole } = auth()
    if (!userId) {
        throw new Error('Unauthorized')
    }
    return { xata, userId, orgId, orgRole }
}

// auth access to libs

export const authWriteToLib = async (lib: string, explicitUserId?: string) => {
    const { xata, userId, orgId, orgRole } = explicitUserId ? { userId: explicitUserId, orgId: undefined, orgRole: undefined, xata: getXataClient() } : getAuthOrThrow()
    const rec = await xata.db.libraries.select(['lang']).filter({
        $all: [
            { id: lib },
            { $any: [{ owner: userId }, ...(orgId && orgRole === 'org:admin' ? [{ org: orgId }] : [])] },
        ]
    }).getFirstOrThrow()
    return rec
}

export const authReadToLib = async (lib: string) => {
    const { xata, userId, orgId, orgRole } = getAuthOrThrow()
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

    const isReadOnly = rec.owner !== auth().userId && (!orgId || orgRole !== 'org:admin')
    const isOwner = rec.owner === auth().userId
    const { lang } = rec
    const isOrganizational = !!orgId && rec.org === orgId
    return { rec, isReadOnly, isOwner, lang, isOrganizational }
}

// auth access to items related to libs

export const authWriteToText = async (text: string) => {
    const { xata, userId, orgId, orgRole } = getAuthOrThrow()
    const rec = await xata.db.texts.filter({
        $all: [
            { id: text },
            { $any: [{ 'lib.owner': userId }, ...(orgId && orgRole === 'org:admin' ? [{ 'lib.org': orgId }] : [])] },
        ]
    }).getFirstOrThrow()
    return rec
}

export const authReadToText = async (text: string) => {
    const { xata, userId, orgId } = getAuthOrThrow()
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
const isStarredByUser = () => {
    const { userId } = getAuthOrThrow()
    return { 'lib.starredBy': { $includes: userId } }
}

const isOwnedByUser = () => {
    const { userId } = getAuthOrThrow()
    return { 'lib.owner': userId }
}

const isAccessibleToUserOnly = () => {
    return {
        $any: [
            {
                ...isOwnedByUser(),
                $notExists: 'lib.org'
            },
            {
                $all: [
                    isStarredByUser(),
                    isPublic
                ]
            }
        ]
    }
}

export const isAccessibleToUserOrg = () => {
    const { orgId } = getAuthOrThrow()
    return orgId ? {
        'lib.org': orgId,
    } : {}
}

export const isListed = () => {
    const { orgId } = getAuthOrThrow()
    return orgId ? isAccessibleToUserOrg() : isAccessibleToUserOnly()
}

export const isAccessibleAndRelevantToUser = () => {
    return {
        $any: [
            isOwnedByUser(),
            isAccessibleToUserOnly(),
            isAccessibleToUserOrg(),
        ]
    }
}
