import 'server-only'
import { supabase } from '@/server/client/supabase'
import { revalidateTag } from 'next/cache'

export async function retrieveAudioUrl({ id }: { id: string }) {
    const { data } = await supabase.storage
        .from('user-files')
        .createSignedUrl(`audio/${id}.mp3`, 60 * 60 * 24 * 30)

    if (!data) {
        return null
    }

    return data.signedUrl
}

export async function uploadAudio({ id, audio }: { id: string, audio: File }) {
    const path = `audio/${id}.mp3`

    const { data: uploadData } = await supabase.storage
        .from('user-files')
        .upload(path, await audio.arrayBuffer(), {
            contentType: 'audio/mpeg',
            upsert: true
        })

    if (!uploadData?.path) throw new Error('Failed to upload audio')

    const url = await retrieveAudioUrl({ id })

    revalidateTag(`audio:${id}`)
    return url!
}
