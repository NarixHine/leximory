import { getAudioQuota, getCommentaryQuota } from '@repo/user/quota'
import GradientCard from './card'
import { CircularProgress } from "@heroui/progress"
import moment from 'moment'
import 'moment/locale/zh-cn'

function createQuotaUI({
    getQuota,
    className,
    name,
}: {
    getQuota: () => Promise<{ quota: number, max: number, percentage: number, ttl: number }>
    className?: string
    name: string
}) {
    const Card = async () => {
        const { quota, max, percentage, ttl } = await getQuota()
        const ttlText = ttl > 0 ? `（${moment.duration(ttl, 'seconds').locale('zh-cn').humanize()}后重置）` : ''
        return <GradientCard title={name} caption={ttlText} text={`${quota} / ${max}`} className={className}>
            <CircularProgress
                size='lg'
                value={percentage}
                color='primary'
                showValueLabel={true}
                classNames={{
                    track: 'stroke-white/50',
                }}
            />
        </GradientCard>
    }
    const Skeleton = () => <GradientCard
        title={name}
        className={className}
    />
    return { Card, Skeleton }
}

export const CommentaryQuotaUI = createQuotaUI({
    name: 'AI 词点额度',
    getQuota: getCommentaryQuota,
    className: 'bg-linear-to-br from-primary-50 to-secondary-50 dark:bg-linear-to-bl dark:from-stone-900 dark:to-default-200'
})

export const AudioQuotaUI = createQuotaUI({
    name: 'AI 语点额度',
    getQuota: getAudioQuota,
})
