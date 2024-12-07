import { getAudioQuota, getCommentaryQuota } from '@/lib/quota'
import GradientCard from './card'
import { CircularProgress } from '@nextui-org/progress'

export const CommentaryQuotaCard = async () => {
    const { quota, max, percentage } = await getCommentaryQuota()
    return <GradientCard title={'本月 AI 注解额度'} text={`${quota} / ${max}`}>
        <CircularProgress
            size='lg'
            value={percentage}
            color='secondary'
            showValueLabel={true}
            classNames={{
                track: 'stroke-white/20',
            }}
        />
    </GradientCard>
}

export const AudioQuotaCard = async () => {
    const { quota, max, percentage } = await getAudioQuota()
    return <GradientCard title={'本月 AI 音频额度'} text={`${quota} / ${max}`} gradient={'bg-gradient-to-br from-primary-400 to-danger-300'}>
        <CircularProgress
            size='lg'
            value={percentage}
            color='primary'
            showValueLabel={true}
            classNames={{
                track: 'stroke-white/20',
            }}
        />
    </GradientCard>
}
