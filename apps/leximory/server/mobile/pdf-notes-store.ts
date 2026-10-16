import 'server-only'
import type { supabase } from '@repo/supabase'
import type { Database } from '@repo/supabase/types'
import { pdfPageDrawingSchema } from '@repo/api'
import { checkedResponse } from './http'
import type { PDFNotesStore, PDFNoteScope, PDFPageDrawing, PDFPageSave } from './pdf-notes'

type Row = Database['public']['Tables']['pdf_page_notes']['Row']
function drawing(row: Row): PDFPageDrawing {
    return checkedResponse(pdfPageDrawingSchema, {
        pageIndex: row.page_index,
        drawingBase64: row.drawing_base64,
        canvasWidth: row.canvas_width,
        canvasHeight: row.canvas_height,
        formatVersion: row.format_version,
        revision: row.revision,
    })
}

export function createPDFNotesStore(database: Pick<typeof supabase, 'from'>): PDFNotesStore {
    function scoped(scope: PDFNoteScope) {
        return database
            .from('pdf_page_notes')
            .select('*')
            .eq('user_id', scope.userId)
            .eq('text_id', scope.textId)
            .eq('pdf_version', scope.pdfVersion)
    }
    return {
        async next(scope, after, signal) {
            const { data } = await scoped(scope)
                .gt('page_index', after)
                .order('page_index')
                .limit(1)
                .abortSignal(signal)
                .maybeSingle()
                .throwOnError()
            return data ? drawing(data) : null
        },
        async save(scope, input: PDFPageSave, signal) {
            const values = {
                drawing_base64: input.drawingBase64,
                canvas_width: input.canvasWidth,
                canvas_height: input.canvasHeight,
                format_version: input.formatVersion,
                revision: input.revision,
                updated_at: new Date().toISOString(),
            }
            if (input.baseRevision === null) {
                const { data, error } = await database
                    .from('pdf_page_notes')
                    .insert({
                        ...values,
                        user_id: scope.userId,
                        text_id: scope.textId,
                        pdf_version: scope.pdfVersion,
                        page_index: input.pageIndex,
                    })
                    .select('*')
                    .abortSignal(signal)
                    .maybeSingle()
                if (error && error.code !== '23505') throw error
                if (data) return drawing(data)
            } else {
                const { data } = await database
                    .from('pdf_page_notes')
                    .update(values)
                    .eq('user_id', scope.userId)
                    .eq('text_id', scope.textId)
                    .eq('pdf_version', scope.pdfVersion)
                    .eq('page_index', input.pageIndex)
                    .eq('revision', input.baseRevision)
                    .select('*')
                    .abortSignal(signal)
                    .maybeSingle()
                    .throwOnError()
                if (data) return drawing(data)
            }
            const { data } = await scoped(scope)
                .eq('page_index', input.pageIndex)
                .abortSignal(signal)
                .maybeSingle()
                .throwOnError()
            if (!data) return null
            const current = drawing(data)
            return current.revision === input.revision &&
                current.drawingBase64 === input.drawingBase64 &&
                current.canvasWidth === input.canvasWidth &&
                current.canvasHeight === input.canvasHeight &&
                current.formatVersion === input.formatVersion
                ? current
                : null
        },
    }
}
