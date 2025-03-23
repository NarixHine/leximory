import { getAudioQuota, getCommentaryQuota } from '@/server/auth/quota'
import GradientCard from './card'
import { CircularProgress } from "@heroui/progress"

export const CommentaryQuotaCard = async () => {
    const { quota, max, percentage } = await getCommentaryQuota()
    return <GradientCard title={'本月 AI 注解额度'} text={`${quota} / ${max}`}>
        <CircularProgress
            size='lg'
            value={percentage}
            color='secondary'
            showValueLabel={true}
            classNames={{
                track: 'stroke-white/50',
            }}
        />
    </GradientCard>
}

export const AudioQuotaCard = async () => {
    const { quota, max, percentage } = await getAudioQuota()
    return <GradientCard title={'本月 AI 音频额度'} text={`${quota} / ${max}`} className={'bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-default-100 dark:to-default-200'}>
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
