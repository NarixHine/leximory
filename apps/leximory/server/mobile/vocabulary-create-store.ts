import type { supabase } from '@repo/supabase'
import type { MobileSubject } from '@repo/schema/mobile'
import type { Lang } from '@repo/schema/library'
import { MobileError } from './errors'
import { createHash } from 'node:crypto'
import { serializeWord } from './word-format'
import { saveVocabularyOnce } from './vocabulary-save'
import { invalidateMutationCaches } from './mutation-effects'
import type { VocabularyCreateStore } from './vocabulary-create'

export function createVocabularyStore(dependencies: {
    database: Pick<typeof supabase, 'from'>
    receipts: {
        set(key: string, value: string, options: { nx: true; ex: number }): Promise<unknown>
        get(key: string): Promise<unknown>
    }
    destination(subject: MobileSubject, language: Lang): Promise<string>
}): VocabularyCreateStore {
    const { database, receipts } = dependencies
    return {
        async save(subject, input) {
            const word = serializeWord(input.fields)
            const hash = createHash('sha256')
                .update(JSON.stringify([input.language, word]))
                .digest('hex')
            const receipt = `mobile:vocabulary-create:${subject.userId}:${input.requestId}`
            await receipts.set(receipt, hash, { nx: true, ex: 30 * 86400 })
            if ((await receipts.get(receipt)) !== hash) throw new MobileError('invalid_input')
            const saved = await saveVocabularyOnce(
                { userId: subject.userId, sourceLibrary: 'authored-vocabulary', requestId: input.requestId },
                {
                    destination: () => dependencies.destination(subject, input.language),
                    async lookup(id) {
                        const { data: value } = await database
                            .from('lexicon')
                            .select('id,lib')
                            .eq('id', id)
                            .maybeSingle()
                            .throwOnError()
                        if (!value?.lib) return null
                        const { data: library } = await database
                            .from('libraries')
                            .select('owner')
                            .eq('id', value.lib)
                            .maybeSingle()
                            .throwOnError()
                        return { id: value.id, libraryId: value.lib, owner: library?.owner ?? null }
                    },
                    async insertIfAbsent(id, libraryId) {
                        await database
                            .from('lexicon')
                            .upsert({ id, lib: libraryId, word }, { onConflict: 'id', ignoreDuplicates: true })
                            .throwOnError()
                    },
                },
            )
            invalidateMutationCaches(`words:${saved.libraryId}`)
            invalidateMutationCaches('words')
            return saved
        },
    }
}
