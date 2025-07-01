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
        description: 'An experimental AI-driven publication for English learners.',
    }
}

export default function TimesPage() {
    return <TheTimes />
}
