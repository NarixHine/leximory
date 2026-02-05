import 'server-only'
import { supabase } from '@repo/supabase'
import { DictationContentSchema, type DictationContent } from '@repo/schema/chunk-note'
import type { Json } from './types'

export type { DictationContent } from '@repo/schema/chunk-note'

/**
 * Gets a dictation by paper ID.
 */
export async function getDictation({ paperId }: { paperId: number }): Promise<{ id: number; content: DictationContent; createdAt: string } | null> {
    const { data, error } = await supabase
        .from('dictations')
        .select('id, content, created_at')
        .eq('paper', paperId)
        .single()
    
    if (error) {
        if (error.code === 'PGRST116') {
            // No dictation found
            return null
        }
        throw error
    }
    
    return {
        id: data.id,
        content: DictationContentSchema.parse(data.content),
        createdAt: data.created_at,
    }
}

/**
 * Creates a new dictation for a paper.
 */
export async function createDictation({ paperId, content }: { paperId: number; content: DictationContent }) {
    const { data, error } = await supabase
        .from('dictations')
        .insert({
            paper: paperId,
            content: content as Json,
        })
        .select()
        .single()
    
    if (error) throw error
    return data
}

/**
 * Deletes a dictation by ID.
 */
export async function deleteDictation({ id }: { id: number }) {
    const { error } = await supabase
        .from('dictations')
        .delete()
        .eq('id', id)
    
    if (error) throw error
}
