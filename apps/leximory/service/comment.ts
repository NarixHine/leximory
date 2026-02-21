'use server'

import { Kilpi } from '@repo/service/kilpi'
import { extractSaveForm } from '@repo/utils'
import { updateText, getTextWithLib } from '@/server/db/text'
import { deleteWord, getWord, saveWord, shadowSaveWord, updateWord } from '@/server/db/word'
import { updateTag } from 'next/cache'
import { getUserOrThrow } from '@repo/user'
import { getLib } from '@/server/db/lib'

/** Deletes a vocabulary comment after verifying library write access via Kilpi. */
export async function delComment(id: string) {
    const { lib } = await getWord({ id })
    const libData = await getLib({ id: lib })
    await Kilpi.libraries.write(libData).authorize().assert()
    await deleteWord(id)
    updateTag(`words:${lib}`)
    updateTag(`words`)
}

/** Saves or updates a vocabulary comment with Kilpi authorization. */
export async function saveComment({ portions, lib, editId, shadow, lang }: { portions: string[], lib: string, editId?: string, shadow?: boolean, lang: "en" | "zh" | "ja" | "nl" }) {
    const word = `{{${extractSaveForm(portions.filter(Boolean)).join('||')}}}`
    const revalidate = () => {
        updateTag(`words:${lib}`)
        updateTag(`words`)
    }
    const { userId } = await getUserOrThrow()
    if (editId) {
        const { lib } = await getWord({ id: editId })
        const libData = await getLib({ id: lib })
        await Kilpi.libraries.write(libData).authorize().assert()
        await updateWord({ id: editId, word })
        revalidate()
        return editId
    } else {
        if (shadow) {
            const { id } = await shadowSaveWord({ word, uid: userId, lang })
            revalidate()
            return id
        }
        else {
            const libData = await getLib({ id: lib })
            await Kilpi.libraries.write(libData).authorize().assert()
            const { id } = await saveWord({ lib, word })
            revalidate()
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
