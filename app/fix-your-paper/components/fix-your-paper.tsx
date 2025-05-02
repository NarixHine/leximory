'use client'

import { useAtom, useSetAtom } from 'jotai'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@heroui/react'
import { analyzePaper, compareAnswers } from '../actions'
import {
    paperFileAtom,
    answerFileAtom,
    isLoadingAtom,
    resultAtom,
    canSubmitAtom,
    paperAnalysisAtom
} from '../atoms'
import { PiSealCheckDuotone, PiUpload } from 'react-icons/pi'
import { CHINESE_ZCOOL } from '@/lib/fonts'
import { MAX_FILE_SIZE } from '@/lib/config'

export default function FixPaper() {
    const [paperFile, setPaperFile] = useAtom(paperFileAtom)
    const [answerFile, setAnswerFile] = useAtom(answerFileAtom)
    const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
    const setResult = useSetAtom(resultAtom)
    const [canSubmit] = useAtom(canSubmitAtom)
    const setPaperAnalysis = useSetAtom(paperAnalysisAtom)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFile: (files: File[]) => void) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile([e.target.files[0]])
            setResult(null)
            setPaperAnalysis(null)
        }
    }

    const handleFix = async () => {
        if (!canSubmit) return

        if (paperFile[0].size + answerFile[0].size > MAX_FILE_SIZE) {
            toast.error('文件总大小不能超过4.5MB。')
            return
        }

        setIsLoading(true)
        try {
            // Step 1: Analyze the paper
            const paperAnalysis = await analyzePaper(paperFile[0])
            setPaperAnalysis(paperAnalysis)
            // Step 2: Compare with answer key
            const comparison = await compareAnswers(paperFile[0], answerFile[0], paperAnalysis)
            setResult(comparison)
        } catch {
            toast.error('发生错误，可能是请求超时或额度不足。')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div className='relative group'>
                    <input
                        type='file'
                        accept='.txt,.pdf'
                        onChange={(e) => handleFileChange(e, setPaperFile)}
                        className='hidden'
                        id='paper-upload'
                    />
                    <label
                        htmlFor='paper-upload'
                        className='block p-4 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg cursor-pointer hover:border-primary transition-colors'
                    >
                        <div className='flex flex-col items-center justify-center text-center'>
                            <PiUpload className='text-2xl mb-2 text-neutral-400 group-hover:text-primary transition-colors' />
                            <span className='text-sm font-medium'>
                                {paperFile.length > 0 ? paperFile[0].name : '上传试卷'}
                            </span>
                        </div>
                    </label>
                </div>

                <div className='relative group'>
                    <input
                        type='file'
                        accept='.txt,.pdf'
                        onChange={(e) => handleFileChange(e, setAnswerFile)}
                        className='hidden'
                        id='answer-upload'
                    />
                    <label
                        htmlFor='answer-upload'
                        className='block p-4 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg cursor-pointer hover:border-primary transition-colors'
                    >
                        <div className='flex flex-col items-center justify-center text-center'>
                            <PiUpload className='text-2xl mb-2 text-neutral-400 group-hover:text-primary transition-colors' />
                            <span className='text-sm font-medium'>
                                {answerFile.length > 0 ? answerFile[0].name : '上传答案'}
                            </span>
                        </div>
                    </label>
                </div>
            </div>

            <div className='flex justify-center w-full'>
                <Button
                    onPress={handleFix}
                    disabled={!canSubmit}
                    className={cn('w-full md:w-48', CHINESE_ZCOOL.className)}
                    color='primary'
                    variant='flat'
                    fullWidth
                    startContent={<PiSealCheckDuotone className='text-xl' />}
                    isLoading={isLoading}
                >
                    AI 审题
                </Button>
            </div>
        </>
    )
}
