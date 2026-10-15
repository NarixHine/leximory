import 'server-only'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { createDefinitionOperations } from '../definitions'
import { catalogStore } from '../store'
import { definitionServices } from '../definition-services'

const operations = createDefinitionOperations({ store: catalogStore, services: definitionServices })

export const definitions = mobileEndpoint(verify, operations.definitions, 60000)
export const vocabulary = mobileEndpoint(verify, operations.vocabulary, 60000)
export const ebookDefinitions = mobileEndpoint(verify, operations.ebookDefinitions, 60000)
export const ebookVocabulary = mobileEndpoint(verify, operations.ebookVocabulary, 60000)
