import { checkedResponse } from './http'
import 'server-only'
import { supabase } from '@repo/supabase'
import { LIB_ACCESS_STATUS } from '@repo/env/config'
import { invalidateMutationCaches } from './mutation-effects'
import { getLanguageStrategy } from '@/lib/languages'
import { libraryRowSchema } from './catalog'
import { mobileMutationID } from './vocabulary-save'
import { MobileError } from './errors'
import type { FolderStore } from './folders'

export const folderStore: FolderStore = {
    async create(subject, input, signal) {
        const id = mobileMutationID('folder', subject.userId, input.requestId)
        await supabase
            .from('libraries')
            .upsert(
                {
                    id,
                    owner: subject.userId,
                    name: input.name,
                    lang: input.language,
                    access: LIB_ACCESS_STATUS.private,
                    shadow: false,
                },
                { onConflict: 'id', ignoreDuplicates: true },
            )
            .abortSignal(signal)
            .throwOnError()
        const { data } = await supabase
            .from('libraries')
            .select('*')
            .eq('id', id)
            .abortSignal(signal)
            .single()
            .throwOnError()
        const library = checkedResponse(libraryRowSchema, data)
        if (library.owner !== subject.userId || library.lang !== input.language || library.shadow)
            throw new MobileError('inaccessible')
        await supabase
            .from('lexicon')
            .upsert(
                {
                    id: mobileMutationID('folder-welcome', id),
                    lib: id,
                    word: getLanguageStrategy(input.language).welcome,
                },
                { onConflict: 'id', ignoreDuplicates: true },
            )
            .abortSignal(signal)
            .throwOnError()
        invalidateMutationCaches('libraries')
        return library
    },
    async rename(library, name, signal) {
        const { data } = await supabase
            .from('libraries')
            .update({ name })
            .eq('id', library.id)
            .eq('owner', library.owner)
            .select('*')
            .abortSignal(signal)
            .single()
            .throwOnError()
        invalidateMutationCaches('libraries')
        invalidateMutationCaches('lib:' + library.id)
        return checkedResponse(libraryRowSchema, data)
    },
}
