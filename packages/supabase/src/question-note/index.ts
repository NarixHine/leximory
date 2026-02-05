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
    creator,
}: {
    sentence: string
    correctAnswer: string
    wrongAnswer?: string
    keyPoints: string
    relatedPaper?: number
    creator: string
}) {
    const content = serializeQuestionNoteContent({ sentence, correctAnswer, wrongAnswer, keyPoints })
    
    const { data } = await supabase
        .from('notes')
        .insert({ 
            content,
            type: 'question',
            related_paper: relatedPaper ?? null,
            creator,
        })
        .select()
        .single()
        .throwOnError()
    
    return data
}

/**
 * Loads question notes with pagination for a specific user.
 */
export async function loadQuestionNotes({ cursor, creator }: { cursor?: string, creator: string }) {
    const { data } = await supabase
        .from('notes')
        .select('content, id, created_at, related_paper')
        .eq('type', 'question')
        .eq('creator', creator)
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
 * Only deletes if the note belongs to the specified creator.
 */
export async function deleteQuestionNote({ id, creator }: { id: number, creator: string }) {
    const { data } = await supabase
        .from('notes')
        .delete()
        .eq('id', id)
        .eq('creator', creator)
        .select()
        .single()
        .throwOnError()
    
    return data
}
