import { getReviewStreakData } from '@/server/db/review'
import { ReviewStreak } from './review-streak'

interface ReviewStreakServerProps {
    userId: string
}

export async function ReviewStreakServer({ userId }: ReviewStreakServerProps) {
    const streak = await getReviewStreakData(userId)
    return <ReviewStreak streak={streak} />
}
