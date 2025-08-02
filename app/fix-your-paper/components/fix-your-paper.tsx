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
            if (e.target.files[0].size > MAX_FILE_SIZE) {
                toast.error(`文件大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`)
                return
            }

            toast.success('文件就绪')
            setFile([e.target.files[0]])
            setResult('')
            setPaperAnalysis('')
        }
    }

    const handleFix = async () => {
        setIsLoading(true)
        setResult('')
        setPaperAnalysis('')
        try {
            // Step 1: Analyze the paper
            const { output: paperAnalysisOutput, error: paperAnalysisError } = await analyzePaper(paperFile[0])
            if (paperAnalysisError) {
                toast.error(paperAnalysisError)
                return
            }
            if (paperAnalysisOutput) {
                setPaperAnalysis(paperAnalysisOutput)
            }

            // Step 2: Compare with answer key
            const { output: comparisonOutput, error: comparisonError } = await compareAnswers(paperFile[0], answerFile[0], paperAnalysisOutput!)
            if (comparisonError) {
                toast.error(comparisonError)
                return
            }
            if (comparisonOutput) {
                setResult(comparisonOutput)
            }
        } catch {
            toast.error('发生错误，可能是请求超时')
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
                            <span className='text-sm font-medium font-formal'>
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
                            <span className='text-sm font-medium font-formal'>
                                {answerFile.length > 0 ? answerFile[0].name : '上传答案'}
                            </span>
                        </div>
                    </label>
                </div>
            </div>

            <div className='flex justify-center w-full'>
                <Button
                    onPress={handleFix}
                    isDisabled={!canSubmit}
                    className={cn('w-full md:w-48')}
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
