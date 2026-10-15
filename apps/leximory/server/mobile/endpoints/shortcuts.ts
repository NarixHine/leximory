import 'server-only'
import { after } from 'next/server'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { createShortcutOperations } from '../shortcuts'
import { detectLanguage } from '../language-detection'
import { shadowLibrary } from '../shadow-library'
import { definitionServices } from '../definition-services'
import { shortcutStore } from '../shortcut-store'

const operations = createShortcutOperations({
    detectLanguage,
    shadowLibrary,
    definitions: definitionServices,
    shortcuts: shortcutStore,
    after,
})
export const saveShortcutWord = mobileEndpoint(verify, operations.saveShortcutWord, 60000)
