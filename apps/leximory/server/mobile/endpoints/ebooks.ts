import 'server-only'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { createEbookOperations } from '../ebooks'
import { catalogStore } from '../store'
import { ebookStore } from '../ebook-store'

const operations = createEbookOperations({ catalog: catalogStore, ebooks: ebookStore })

export const ebook = mobileEndpoint(verify, operations.ebook, 20000)
export const ebookPosition = mobileEndpoint(verify, operations.ebookPosition, 20000)
export const ebookBookmark = mobileEndpoint(verify, operations.ebookBookmark, 20000)
export const removeEbookBookmark = mobileEndpoint(verify, operations.removeEbookBookmark, 20000)
