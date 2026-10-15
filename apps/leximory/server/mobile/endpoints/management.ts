import 'server-only'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { createManagementOperations } from '../management'
import { managementStore } from '../management-store'
import { authoringStore } from '../authoring-store'
import { catalogStore } from '../store'

const operations = createManagementOperations({
    catalog: catalogStore,
    authoring: authoringStore,
    management: managementStore,
})
export const editableText = mobileEndpoint(verify, operations.editableText, 60000)
export const editText = mobileEndpoint(verify, operations.editText, 60000)
export const removeText = mobileEndpoint(verify, operations.removeText, 60000)
export const replaceEbook = mobileEndpoint(verify, operations.replaceEbook, 60000)
export const removeEbook = mobileEndpoint(verify, operations.removeEbook, 60000)
export const removeWord = mobileEndpoint(verify, operations.removeWord, 60000)
