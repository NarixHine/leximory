import 'server-only'

import { getXataClient } from '@/lib/xata'
import { convertReadableToBinaryFile } from '@/lib/utils'
import { Readable } from 'stream'

const xata = getXataClient()

export async function retrieveAudioUrl({ id }: { id: string }) {
    const audio = await xata.db.audio.select(['gen']).filter({ id }).getFirst()
    return audio?.gen?.url
}

export async function uploadAudio({ id, lib, audio }: { id: string, lib: string, audio: Readable }) {
    await xata.db.audio.create({
        id,
        lib,
        gen: {
            enablePublicUrl: true,
        }
    })
    await xata.files.upload({ table: 'audio', column: 'gen', record: id }, await convertReadableToBinaryFile(audio), {
        mediaType: 'audio/mpeg',
    })

    const url = await retrieveAudioUrl({ id }) as string
    return url
}
