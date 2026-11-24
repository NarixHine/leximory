import 'server-only'
import { createEbookUploadOperations } from '../ebook-upload'
import { ebookStaging } from '../ebook-staging-store'
import { mobileEndpoint } from '../http'
import { catalogStore } from '../store'
import { verify } from './verify'

const operations = createEbookUploadOperations({ catalog: catalogStore, staging: ebookStaging })
export const prepareEbookUpload = mobileEndpoint(verify, operations.prepareEbookUpload, 20000)
