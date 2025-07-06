import TheTimes from '@/components/times'
import { Metadata } from 'next'
import { momentSH } from '@/lib/moment'

interface TimesPageProps {
    searchParams: Promise<{ date?: string }>
}

export async function generateMetadata({ searchParams }: TimesPageProps): Promise<Metadata> {
    const { date } = await searchParams

    if (date) {
        const formattedDate = momentSH(date).format('LL')
        return {
            title: `The Leximory Times: ${formattedDate}`,
            description: `Issue ${formattedDate}. An experimental AI-driven publication for English learners.`,
        }
    }

    return {
        title: 'The Leximory Times: Daily Novel, News & Quiz',
        description: '火星日报是一份搭载 AI 的实验性英语学习日刊。',
    }
}

export default function TimesPage() {
    return <TheTimes />
}
