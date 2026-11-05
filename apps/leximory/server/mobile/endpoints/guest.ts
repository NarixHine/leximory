import 'server-only'
import { redis } from '@repo/kv/redis'
import { createGuestOperations } from '../guest'
import { createGuestStore } from '../guest-store'
import { definitionServices } from '../definition-services'
import { detectLanguage } from '../language-detection'
import { publicMobileEndpoint } from '../http'

const operations = createGuestOperations({
    store: createGuestStore(redis),
    definitions: { ...definitionServices, detectLanguage },
})
export const guestSession = publicMobileEndpoint(operations.guestSession)
export const guestRevokeSession = publicMobileEndpoint(operations.guestRevokeSession)
export const guestDefinitions = publicMobileEndpoint(operations.guestDefinitions, 65000)
export const guestDefinitionResult = publicMobileEndpoint(operations.guestDefinitionResult)
