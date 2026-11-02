import 'server-only'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { createEbookImportOperations } from '../ebook-import'
import { ebookImportStore } from '../ebook-import-store'

const operations = createEbookImportOperations(ebookImportStore)
export const suggestEbookImport = mobileEndpoint(verify, operations.suggestEbookImport, 20000)
