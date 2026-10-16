import 'server-only'
import { supabase } from '@repo/supabase'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { catalogStore } from '../store'
import { createPDFNotesOperations } from '../pdf-notes'
import { createPDFNotesStore } from '../pdf-notes-store'

const operations = createPDFNotesOperations({ catalog: catalogStore, notes: createPDFNotesStore(supabase) })
export const pdfNotes = mobileEndpoint(verify, operations.pdfNotes)
export const savePDFNote = mobileEndpoint(verify, operations.savePDFNote)
