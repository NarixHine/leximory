import 'server-only'
import { supabase } from '@/server/client/supabase'
import { revalidateTag } from 'next/cache'

export async function retrieveAudioUrl({ id }: { id: string }) {
    const { data } = await supabase
        .from('audio')
        .select('gen')
        .eq('id', id)
        .single()

    if (!data?.gen) return null

    const { data: { signedUrl } } = await supabase.storage
        .from('user-files')
        .createSignedUrl(data.gen, 60 * 60 * 24 * 30) as { data: { signedUrl: string } }

    return signedUrl
}

export async function uploadAudio({ id, lib, audio }: { id: string, lib: string, audio: File }) {
    const path = `audio/${id}.mp3`

    const { data: uploadData } = await supabase.storage
        .from('user-files')
        .upload(path, await audio.arrayBuffer(), {
            contentType: 'audio/mpeg',
            upsert: true
        })

    if (!uploadData?.path) throw new Error('Failed to upload audio')

    await supabase
        .from('audio')
        .insert({
            id,
            lib,
            gen: uploadData.path
        })

    const url = await retrieveAudioUrl({ id })

    revalidateTag(`audio:${id}`)
    return url!
}
