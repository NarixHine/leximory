import 'server-only'
import { supabase } from '@repo/supabase'
import { stdMoment } from '@repo/utils'
import { serializeQuestionNoteContent } from '@repo/schema/question-note'

// Re-export types from schema for convenience
export type { QuestionNoteContent } from '@repo/schema/question-note'
export { parseQuestionNoteContent, serializeQuestionNoteContent } from '@repo/schema/question-note'

/**
 * Saves a question note to the notes table.
 */
export async function saveQuestionNote({
    sentence,
    correctAnswer,
    wrongAnswer,
    keyPoints,
    relatedPaper,
}: {
    sentence: string
    correctAnswer: string
    wrongAnswer?: string
    keyPoints: string
    relatedPaper?: number
}) {
    const content = serializeQuestionNoteContent({ sentence, correctAnswer, wrongAnswer, keyPoints })
    
    const { data } = await supabase
        .from('notes')
        .insert({ 
            content,
            type: 'question',
            related_paper: relatedPaper ?? null,
        })
        .select()
        .single()
        .throwOnError()
    
    return data
}

/**
 * Loads question notes with pagination.
 */
export async function loadQuestionNotes({ cursor }: { cursor?: string }) {
    const { data } = await supabase
        .from('notes')
        .select('content, id, created_at, related_paper')
        .eq('type', 'question')
        .order('created_at', { ascending: false })
        .range(cursor ? parseInt(cursor) : 0, (cursor ? parseInt(cursor) : 0) + 19)
        .throwOnError()
    
    return {
        notes: data.map(({ content, id, created_at, related_paper }) => ({
            content,
            id,
            date: created_at ? stdMoment(created_at).format('ll') : '',
            relatedPaper: related_paper,
        })),
        cursor: cursor ? (parseInt(cursor) + 20).toString() : '20',
        more: data.length === 20
    }
}

/**
 * Deletes a question note by ID.
 */
export async function deleteQuestionNote({ id }: { id: number }) {
    const { data } = await supabase
        .from('notes')
        .delete()
        .eq('id', id)
        .select()
        .single()
        .throwOnError()
    
    return data
}
