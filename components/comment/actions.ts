'use server'

import { authWriteToLib, authWriteToText, getAuthOrThrow } from '@/server/auth/role'
import { extractSaveForm } from '@/lib/lang'
import { updateText } from '@/server/db/text'
import { deleteWord, getWord, saveWord, shadowSaveWord, updateWord } from '@/server/db/word'
import { after } from 'next/server'
import { logsnagServer } from '@/lib/logsnag'

export async function delComment(id: string) {
    const { lib } = await getWord({ id })
    await authWriteToLib(lib!.id)
    await deleteWord(id)
}

export async function saveComment({ portions, lib, editId, shadow, lang }: { portions: string[], lib: string, editId?: string, shadow?: boolean, lang: "en" | "zh" | "ja" | "nl" }) {
    const word = `{{${extractSaveForm(portions.filter(Boolean)).join('||')}}}`

    after(async () => {
        await logsnagServer().insight.increment({
            title: '用户保存的词汇',
            value: 1,
            icon: '💾',
        })
    })

    const { userId } = await getAuthOrThrow()
    if (editId) {
        if (shadow) {
            await shadowSaveWord({ word, uid: userId, lang })
        }
        else {
            const { lib } = await getWord({ id: editId })
            await authWriteToLib(lib!.id)
            await updateWord({ id: editId, word })
        }
        return editId
    } else {
        if (shadow) {
            const { id } = await shadowSaveWord({ word, uid: userId, lang })
            return id
        }
        else {
            await authWriteToLib(lib)
            const { id } = await saveWord({ lib, word })
            return id
        }
    }
}

export async function modifyText(id: string, modifiedText: string) {
    await authWriteToText(id)
    await updateText({ id, content: modifiedText })
}