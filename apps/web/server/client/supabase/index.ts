import { createClient } from '@supabase/supabase-js'
import env from '@repo/env'
import { Database } from './types'

export const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
