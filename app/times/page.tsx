import TheTimes from '@/components/times'
import { isAtRead } from '@/lib/subapp'
import { cn } from '@/lib/utils'
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

export default async function TimesPage() {
    return (
        <main className={cn('h-dvh w-full', await isAtRead() ? 'p-0' : 'p-4')}>
            <TheTimes />
        </main>
    )
}
