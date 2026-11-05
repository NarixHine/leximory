import 'server-only'
import { supabase } from '@repo/supabase'
import { mobileEndpoint } from '../http'
import { verify } from './verify'
import { createHomePinsOperations } from '../home-pins'
import { createHomePinsStore } from '../home-pins-store'

const operations = createHomePinsOperations(createHomePinsStore(supabase))
export const homePins = mobileEndpoint(verify, operations.homePins)
export const saveHomePin = mobileEndpoint(verify, operations.saveHomePin)
