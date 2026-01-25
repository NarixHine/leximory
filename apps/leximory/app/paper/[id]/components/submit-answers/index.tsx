'use client'

import { Button } from '@heroui/button'
import { useAtomValue } from 'jotai'
import { submitAnswersAction } from './actions'
import { useAction } from '@repo/service'
import { Key } from '@repo/ui/paper'
import { answersAtom, paperIdAtom } from '@repo/ui/paper/atoms'
import { PiBoxArrowUp } from 'react-icons/pi'

export function SubmitAnswers({ questionCount }: { questionCount: number }) {
    const answers = useAtomValue(answersAtom)
    const paperId = useAtomValue(paperIdAtom)
    const { result: { data }, isPending, execute, hasSucceeded } = useAction(submitAnswersAction)
    const hasCompleted = Object.values(answers).filter(Boolean).length === questionCount

    return (
        <div className='flex flex-col gap-4'>
            <Button
                onPress={() => execute({ answers, id: parseInt(paperId!) })}
                fullWidth
                color='primary'
                startContent={!isPending && <PiBoxArrowUp />}
                isLoading={isPending}
                isDisabled={hasSucceeded || !hasCompleted}
            >
                {
                    hasSucceeded
                        ? '已上传'
                        : hasCompleted ? '提交' : '尚未完成作答'
                }
            </Button>
            {data && <Key data={data} />}
        </div>
    )
}
