'use client'

import { Button } from '@heroui/button'
import { useAtomValue } from 'jotai'
import { submitAnswersAction } from './actions'
import { useAction } from '@repo/service'
import { answersAtom, paperIdAtom } from '@repo/ui/paper/atoms'
import { BoxArrowUpIcon } from '@phosphor-icons/react/ssr'
import { useRouter } from 'next/navigation'
import { ConfirmPopover } from '@repo/ui/confirm-popover'
import { toast } from 'sonner'
import { WarningOctagonIcon } from '@phosphor-icons/react'

export function SubmitAnswers({ questionCount }: { questionCount: number }) {
    const answers = useAtomValue(answersAtom)
    const paperId = useAtomValue(paperIdAtom)
    const router = useRouter()
    const { isPending, execute, hasSucceeded } = useAction(submitAnswersAction, {
        onSuccess() {
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
                    <Button
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
                    </Button>
                )}
            >
                <Button startContent={!isPending && <WarningOctagonIcon weight='duotone' size={20} />} color='primary' fullWidth isLoading={isPending} isDisabled={hasSucceeded}>尚未完成，依然提交</Button>
            </ConfirmPopover>
        </div>
    )
}
