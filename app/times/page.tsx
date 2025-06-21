import TheTimes from '@/components/times'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'The Leximory Times',
    description: '为英语学习者打造的每日新闻和小说，附带词汇注解和一键保存',
}

export default function TimesPage() {
    return (
        <main className='h-dvh w-full p-3'>
            <TheTimes />
        </main>
    )
}
