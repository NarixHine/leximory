import { getAllPaperSubmissions } from '@repo/supabase/paper'
import { getUserById } from '@repo/user'
import { getUser } from '@repo/user'
import { LeaderboardTable } from './leaderboard-table'

type LeaderboardProps = {
    paperId: number
}

type SubmissionWithUser = {
    rank: number
    score: number
    perfectScore: number
    userId: string
    userName: string | undefined
    userImage: string | undefined
    createdAt: string
}

async function getLeaderboardData(paperId: number): Promise<SubmissionWithUser[]> {
    'use cache'
    const submissions = await getAllPaperSubmissions({ paperId })
    
    if (!submissions || submissions.length === 0) {
        return []
    }

    const leaderboardData = await Promise.all(
        submissions.map(async (submission, index) => {
            try {
                const user = await getUserById(submission.user)
                return {
                    rank: index + 1,
                    score: submission.score,
                    perfectScore: submission.perfect_score,
                    userId: submission.user,
                    userName: user.username,
                    userImage: user.image,
                    createdAt: submission.created_at
                }
            } catch (error) {
                return {
                    rank: index + 1,
                    score: submission.score,
                    perfectScore: submission.perfect_score,
                    userId: submission.user,
                    userName: undefined,
                    userImage: undefined,
                    createdAt: submission.created_at
                }
            }
        })
    )

    return leaderboardData
}

export default async function Leaderboard({ paperId }: LeaderboardProps) {
    const leaderboardData = await getLeaderboardData(paperId)
    const currentUser = await getUser()
    const currentUserRank = currentUser 
        ? leaderboardData.findIndex(entry => entry.userId === currentUser.userId) + 1
        : null

    return (
        <LeaderboardTable 
            leaderboardData={leaderboardData}
            currentUser={currentUser}
            currentUserRank={currentUserRank}
        />
    )
}
