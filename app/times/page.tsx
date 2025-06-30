import TheTimes from '@/components/times'
import { isAtRead } from '@/lib/subapp'
import { cn } from '@/lib/utils'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'The Leximory Times',
    description: '为英语学习者打造的每日新闻和小说，附带词汇注解和一键保存',
}

export default async function TimesPage() {
    return (
        <main className={cn('h-dvh w-full', await isAtRead() ? 'p-0' : 'p-4')}>
            <TheTimes />
        </main>
    )
}
