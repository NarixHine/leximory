import 'server-only'
import { supabase } from '@repo/supabase'
import { redis } from '@repo/kv/redis'
import { shadowLibrary } from '../shadow-library'
import { createVocabularyStore } from '../vocabulary-create-store'
import { createVocabularyOperations } from '../vocabulary-create'
import { mobileEndpoint } from '../http'
import { verify } from './verify'

const operations = createVocabularyOperations(
    createVocabularyStore({ database: supabase, receipts: redis, destination: shadowLibrary }),
)
export const createVocabulary = mobileEndpoint(verify, operations.createVocabulary)
