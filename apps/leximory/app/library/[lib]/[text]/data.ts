import { Kilpi } from '@repo/service/kilpi'
import { getTextContent, getTextAnnotationProgress } from '@/server/db/text'
import { supabase } from '@repo/supabase'

/** Fetches a text record with its parent library for authorization. */
async function getTextWithLib(textId: string) {
    const { data, error } = await supabase
        .from('texts')
        .select(`
            *,
            lib:libraries!inner (
                id,
                owner,
                access
            )
        `)
        .eq('id', textId)
        .single()
    if (error || !data) throw new Error('Text not found')
    return data as typeof data & { lib: { id: string, owner: string, access: number } }
}

export const getArticleData = async (text: string, throwOnUnauthorized = true) => {
    if (throwOnUnauthorized) {
        const textWithLib = await getTextWithLib(text)
        await Kilpi.texts.read(textWithLib).authorize().assert()
    }
    const [
        { title, content, topics, ebook, emoji, createdAt, lib, prompt, isPublicAndFree },
        annotating
    ] = await Promise.all([
        getTextContent({ id: text }),
        getTextAnnotationProgress({ id: text })
    ])
    return { title, content, topics, ebook, emoji, createdAt, lib, annotating, prompt, isPublicAndFree }
}
