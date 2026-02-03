'use client'

import { Button } from '@heroui/button'
import { useAtomValue, useSetAtom } from 'jotai'
import { submitAnswersAction } from './actions'
import { useAction } from '@repo/service'
import { answersAtom, paperIdAtom } from '@repo/ui/paper/atoms'
import { BoxArrowUpIcon } from '@phosphor-icons/react/ssr'
import { useRouter } from 'next/navigation'
import { ConfirmPopover } from '@repo/ui/confirm-popover'
import { toast } from 'sonner'
import { WarningOctagonIcon } from '@phosphor-icons/react'
import { ProtectedButton } from '@repo/ui/protected-button'
import { removeWorkingPaperAtom, setWorkingPaperCompletedAtom } from '@/app/components/working-paper/atoms'

export function SubmitAnswers({ questionCount }: { questionCount: number }) {
    const answers = useAtomValue(answersAtom)
    const paperId = useAtomValue(paperIdAtom)
    const setWorkingPaperCompleted = useSetAtom(setWorkingPaperCompletedAtom)
    const router = useRouter()
    const { isPending, execute, hasSucceeded } = useAction(submitAnswersAction, {
        onSuccess() {
            setWorkingPaperCompleted(parseInt(paperId!))
            toast.success('提交成功，刷新中……')
            router.refresh()
        }
    })
    const hasCompleted = Object.values(answers).filter(Boolean).length >= questionCount

    return (
        <div className='flex flex-col gap-4'>
            <ConfirmPopover
                skipConfirm={hasCompleted}
                actionButton={(
                    <ProtectedButton
                        label='登录一下即可查看答案，并且荣登排行榜喵～'
                        onPress={() => execute({ answers, id: parseInt(paperId!) })}
                        fullWidth
                        startContent={!isPending && <BoxArrowUpIcon weight='duotone' />}
                        color='primary'
                        isLoading={isPending}
                        isDisabled={hasSucceeded}
                    >
                        {
                            hasSucceeded
                                ? '已上传'
                                : (hasCompleted ? '提交' : '仅提交已完成部分')
                        }
                    </ProtectedButton>
                )}
            >
                <Button startContent={!isPending && <WarningOctagonIcon weight='duotone' size={20} />} color='primary' fullWidth isLoading={isPending} isDisabled={hasSucceeded}>尚未完成，依然提交</Button>
            </ConfirmPopover>
        </div>
    )
}
