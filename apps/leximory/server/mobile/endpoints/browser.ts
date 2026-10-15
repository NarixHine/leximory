import 'server-only'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { createBrowserOperations } from '../browser'
import { catalogStore } from '../store'
import { browserStore } from '../browser-store'
import { definitionServices } from '../definition-services'

const operations = createBrowserOperations({
    catalog: catalogStore,
    browser: browserStore,
    definitions: definitionServices,
})

export const createBookmark = mobileEndpoint(verify, operations.createBookmark, 60000)
export const browserSelection = mobileEndpoint(verify, operations.browserSelection, 60000)
export const browserDefinitions = mobileEndpoint(verify, operations.browserDefinitions, 60000)
export const browserVocabulary = mobileEndpoint(verify, operations.browserVocabulary, 60000)
export const browserRules = mobileEndpoint(verify, operations.browserRules, 60000)
export const browserRule = mobileEndpoint(verify, operations.browserRule, 60000)
