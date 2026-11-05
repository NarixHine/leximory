import 'server-only'
import { supabase } from '@repo/supabase'
import { allowsAppleSandbox } from '@repo/user/membership'
import { appleSnapshot } from '@repo/user/entitlements'
import { appleGateway } from './apple'
import { createAppleBilling, type AppleRepository } from './service'

export const appleRepository: AppleRepository = {
    async read(environment, chain) {
        const { data } = await supabase
            .from('apple_subscriptions')
            .select('*')
            .eq('environment', environment)
            .eq('original_transaction_id', chain)
            .maybeSingle()
            .throwOnError()
        if (!data) return null
        const parsed = appleSnapshot.safeParse(data)
        if (!parsed.success) throw new Error('Invalid stored Apple snapshot')
        return parsed.data
    },
    async commit(previous, snapshot) {
        if (!previous) {
            const { error } = await supabase.from('apple_subscriptions').insert(snapshot)
            if (error?.code === '23505') return false
            if (error) throw error
            return true
        }
        if (!previous.user_id) return false
        // Never update user_id. ON DELETE SET NULL invalidates the owner predicate too.
        const { user_id: _owner, environment, original_transaction_id, ...updates } = snapshot
        const { data } = await supabase
            .from('apple_subscriptions')
            .update(updates)
            .eq('environment', environment)
            .eq('original_transaction_id', original_transaction_id)
            .eq('version', previous.version)
            .eq('user_id', previous.user_id)
            .select('version')
            .throwOnError()
        return data.length === 1
    },
}
export const appleBilling = createAppleBilling({
    gateway: appleGateway,
    repository: appleRepository,
    sandboxAllowed: allowsAppleSandbox,
})
