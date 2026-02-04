import 'server-only'
import { supabase } from '@repo/supabase'
import { stdMoment } from '@repo/utils'

/**
 * The content structure for a question note.
 */
export interface QuestionNoteContent {
    sentence: string
    correctAnswer: string
    wrongAnswer?: string
    keyPoints: string
}

/**
 * Serializes the question note content to JSON string.
 */
export function serializeQuestionNoteContent(content: QuestionNoteContent): string {
    return JSON.stringify(content)
}

/**
 * Parses a question note content from JSON string.
 */
export function parseQuestionNoteContent(content: string): QuestionNoteContent | null {
    try {
        const parsed = JSON.parse(content)
        if (typeof parsed.sentence === 'string' && typeof parsed.correctAnswer === 'string' && typeof parsed.keyPoints === 'string') {
            return parsed as QuestionNoteContent
        }
        return null
    } catch {
        return null
    }
}

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
