'use server'

import { authWriteToLib, authWriteToText } from '@/lib/auth'
import { extractSaveForm, validateOrThrow } from '@/lib/lang'
import { updateText } from '@/server/text'
import { deleteWord, getWord, saveWord, updateWord } from '@/server/word'

export async function delComment(id: string) {
    const { lib } = await getWord({ id })
    await authWriteToLib(lib!.id)
    await deleteWord(id)
}

export async function saveComment(portions: string[], lib: string, editId?: string) {
    const word = `{{${extractSaveForm(portions.filter(Boolean)).join('||')}}}`
    validateOrThrow(word)

    if (editId) {
        const { lib } = await getWord({ id: editId })
        await authWriteToLib(lib!.id)
        await updateWord({ id: editId, word })
        return editId
    } else {
        await authWriteToLib(lib)
        const { id } = await saveWord({ lib, word })
        return id
    }
}

export async function modifyText(id: string, modifiedText: string) {
    await authWriteToText(id)
    await updateText({ id, content: modifiedText })
}
