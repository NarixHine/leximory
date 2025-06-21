import 'server-only'
import { supabase } from '@/server/client/supabase'
import { PushSubscription } from 'web-push'
import { revalidatePath } from 'next/cache'

export async function getSubsStatus({ userId }: { userId: string }) {
    const { data } = await supabase
        .from('subs')
        .select('hour, subscription')
        .eq('uid', userId)
        .single()

    return data ? {
        hasSubs: true,
        hour: data.hour,
        subscription: data.subscription ? JSON.stringify(data.subscription) : undefined
    } : { hasSubs: false, hour: null, subscription: null }
}

export async function getHourlySubs(hour: number) {
    const { data } = await supabase
        .from('subs')
        .select('uid, subscription')
        .eq('hour', hour)
        .throwOnError()

    return data.map(({ uid, subscription }) => ({
        uid,
        subscription: JSON.parse(JSON.stringify(subscription)) as PushSubscription
    }))
}

export default async function saveSubs({ userId, subs, hour }: { userId: string, subs: PushSubscription, hour: number }) {
    await supabase
        .from('subs')
        .insert({
            uid: userId,
            subscription: JSON.parse(JSON.stringify(subs)),
            hour
        })
        .throwOnError()
    revalidatePath(`/daily`)
}

export async function delSubs({ userId }: { userId: string }) {
    await supabase
        .from('subs')
        .delete()
        .eq('uid', userId)
        .throwOnError()
    revalidatePath(`/daily`)
}
