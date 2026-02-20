'use server'

import { Kilpi } from '@repo/service/kilpi'
import { extractSaveForm } from '@repo/utils'
import { updateText } from '@/server/db/text'
import { deleteWord, getWord, saveWord, shadowSaveWord, updateWord } from '@/server/db/word'
import { after } from 'next/server'
import { updateTag } from 'next/cache'
import { getUserOrThrow } from '@repo/user'
import { getLib } from '@/server/db/lib'
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

/** Deletes a vocabulary comment after verifying library write access via Kilpi. */
export async function delComment(id: string) {
    const { lib } = await getWord({ id })
    const libData = await getLib({ id: lib })
    await Kilpi.libraries.write(libData).authorize().assert()
    await deleteWord(id)
}

/** Saves or updates a vocabulary comment with Kilpi authorization. */
export async function saveComment({ portions, lib, editId, shadow, lang }: { portions: string[], lib: string, editId?: string, shadow?: boolean, lang: "en" | "zh" | "ja" | "nl" }) {
    const word = `{{${extractSaveForm(portions.filter(Boolean)).join('||')}}}`

    after(async () => {
        updateTag(`words:${lib}`)
        updateTag(`words`)
    })

    const { userId } = await getUserOrThrow()
    if (editId) {
        const { lib } = await getWord({ id: editId })
        const libData = await getLib({ id: lib })
        await Kilpi.libraries.write(libData).authorize().assert()
        await updateWord({ id: editId, word })
        return editId
    } else {
        if (shadow) {
            const { id } = await shadowSaveWord({ word, uid: userId, lang })
            return id
        }
        else {
            const libData = await getLib({ id: lib })
            await Kilpi.libraries.write(libData).authorize().assert()
            const { id } = await saveWord({ lib, word })
            return id
        }
    }
}

/** Modifies a text's content after verifying write access via Kilpi. */
export async function modifyText(id: string, modifiedText: string) {
    const text = await getTextWithLib(id)
    await Kilpi.texts.write(text).authorize().assert()
    await updateText({ id, content: modifiedText })
}
