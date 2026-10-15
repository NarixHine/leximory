import 'server-only'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { createAuthoringOperations } from '../authoring'
import { catalogStore } from '../store'
import { authoringStore } from '../authoring-store'

const operations = createAuthoringOperations({ catalog: catalogStore, authoring: authoringStore })

export const extractArticle = mobileEndpoint(verify, operations.extractArticle, 60000)
export const vocabularyList = mobileEndpoint(verify, operations.vocabularyList, 60000)
export const savedWord = mobileEndpoint(verify, operations.savedWord, 60000)
export const editWord = mobileEndpoint(verify, operations.editWord, 60000)
export const importArticle = mobileEndpoint(verify, operations.importArticle, 60000)
export const uploadEbook = mobileEndpoint(verify, operations.uploadEbook, 60000)
