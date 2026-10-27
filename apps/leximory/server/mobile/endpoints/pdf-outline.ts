import 'server-only'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { createPDFOutlineOperations } from '../pdf-outline'
import { pdfOutlineStore } from '../pdf-outline-store'
import { catalogStore } from '../store'
import { ebookStore } from '../ebook-store'

const operations = createPDFOutlineOperations({ catalog: catalogStore, ebooks: ebookStore, outlines: pdfOutlineStore })
export const generatePDFOutline = mobileEndpoint(verify, operations.generatePDFOutline, 120000)
export const savePDFOutline = mobileEndpoint(verify, operations.savePDFOutline, 120000)
