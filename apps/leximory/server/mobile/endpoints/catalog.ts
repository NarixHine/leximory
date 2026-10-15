import 'server-only'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { createCatalogOperations } from '../catalog-operations'
import { catalogStore } from '../store'
import { accountSummary } from '../account-summary'

const operations = createCatalogOperations({ store: catalogStore, account: accountSummary })

export const me = mobileEndpoint(verify, operations.me, 20000)
export const libraries = mobileEndpoint(verify, operations.libraries, 20000)
export const texts = mobileEndpoint(verify, operations.texts, 20000)
export const document = mobileEndpoint(verify, operations.document, 20000)
export const audio = mobileEndpoint(verify, operations.audio, 20000)
