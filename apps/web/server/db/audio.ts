import 'server-only'
import { supabase } from '@repo/supabase'
import { GeneratedAudioFile } from 'ai'

export async function retrieveAudioUrl({ id }: { id: string }) {
    const { data } = await supabase.storage
        .from('user-files')
        .createSignedUrl(`audio/${id}.mp3`, 60 * 60 * 24 * 30)

    if (!data) {
        return null
    }

    return data.signedUrl
}

export async function uploadAudio({ id, audio }: { id: string, audio: GeneratedAudioFile }) {
    const path = `audio/${id}.mp3`

    const { data: uploadData } = await supabase.storage
        .from('user-files')
        .upload(path, audio.uint8Array, {
            contentType: audio.mediaType,
            upsert: true
        })

    if (!uploadData?.path) throw new Error('Failed to upload audio')

    const url = await retrieveAudioUrl({ id })

    return url!
}
