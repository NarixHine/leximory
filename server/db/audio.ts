import 'server-only'

import { getXataClient } from '@/server/client/xata'

const xata = getXataClient()

export async function retrieveAudioUrl({ id }: { id: string }) {
    const audio = await xata.db.audio.select(['gen']).filter({ id }).getFirst()
    return audio?.gen?.url
}

export async function uploadAudio({ id, lib, audio }: { id: string, lib: string, audio: File }) {
    await xata.db.audio.create({
        id,
        lib,
        gen: {
            enablePublicUrl: true,
        }
    })
    await xata.files.upload({ table: 'audio', column: 'gen', record: id }, audio, {
        mediaType: 'audio/mpeg',
    })

    const url = await retrieveAudioUrl({ id }) as string
    return url
}
