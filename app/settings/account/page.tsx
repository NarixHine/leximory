import { Metadata } from 'next'
import Center from '@/components/ui/center'

export const metadata: Metadata = {
    title: '账号管理',
}

export default function AccountPage() {
    return <Center>
        <div className='flex flex-col gap-6'>
            {/* ... migrate all Clerk usages to Supabase-based user abstraction ... */}
        </div>
    </Center>
}
