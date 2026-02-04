'use client'

import { Button, ButtonProps } from '@heroui/button'
import { NotebookIcon } from '@phosphor-icons/react'
import { saveQuestionNoteAction } from '@repo/service/question-note'
import { toast } from 'sonner'
import { useSaveQuestionNoteParams } from './hooks'
import { useMutation } from '@tanstack/react-query'

export function SaveQuestionNoteButton({ 
    localNo, 
    groupId,
    ...props 
}: { 
    localNo: number
    groupId: string 
} & Omit<ButtonProps, 'onPress'>) {
    const { getSaveParams } = useSaveQuestionNoteParams({ localNo, groupId })
    
    const { mutate, isPending, isSuccess } = useMutation({
        mutationKey: ['save-question-note', groupId, localNo],
        mutationFn: async () => {
            const params = getSaveParams()
            if (!params) {
                throw new Error('无法获取题目信息')
            }
            const result = await saveQuestionNoteAction(params)
            if (result?.serverError) {
                throw new Error(result.serverError)
            }
            return result?.data
        },
    })
    
    const handleSave = () => {
        toast.promise(
            new Promise((resolve, reject) => {
                mutate(undefined, {
                    onSuccess: resolve,
                    onError: reject,
                })
            }),
            {
                loading: '正在收录题目……',
                success: '已收录到错题本',
                error: (err) => `收录失败：${err.message}`,
            }
        )
    }
    
    return (
        <Button
            startContent={<NotebookIcon weight='fill' size={20} />}
            color='secondary'
            variant='flat'
            isLoading={isPending}
            isDisabled={isSuccess}
            {...props}
            onPress={handleSave}
        >
            {isSuccess ? '已收录' : '收录题目'}
        </Button>
    )
}
