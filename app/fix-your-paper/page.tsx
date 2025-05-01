'use client'

import { useAtom } from 'jotai'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button, Spacer } from '@heroui/react'
import { analyzePaper, compareAnswers } from './actions'
import {
    paperFileAtom,
    answerFileAtom,
    isLoadingAtom,
    resultAtom,
    canSubmitAtom,
    paperAnalysisAtom
} from './atoms'
import { PiSealCheckDuotone, PiUpload } from 'react-icons/pi'
import H from '@/components/ui/h'
import { CHINESE_ZCOOL, ENGLISH_SERIF, postFontFamily } from '@/lib/fonts'
import Main from '@/components/ui/main'
import Markdown from '@/components/markdown'

export default function FixPaperPage() {
    const [paperFile, setPaperFile] = useAtom(paperFileAtom)
    const [answerFile, setAnswerFile] = useAtom(answerFileAtom)
    const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
    const [result, setResult] = useAtom(resultAtom)
    const [canSubmit] = useAtom(canSubmitAtom)
    const [paperAnalysis, setPaperAnalysis] = useAtom(paperAnalysisAtom)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFile: (files: File[]) => void) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile([e.target.files[0]])
        }
    }

    const handleFix = async () => {
        if (!canSubmit) return

        setIsLoading(true)
        try {
            // Step 1: Analyze the paper
            const paperAnalysis = await analyzePaper(paperFile[0])
            setPaperAnalysis(paperAnalysis)
            // Step 2: Compare with answer key
            const comparison = await compareAnswers(paperFile[0], answerFile[0], paperAnalysis)
            setResult(comparison)
        } catch {
            toast.error('发生错误，可能是请求超时。')
        } finally {
            setIsLoading(false)
        }
    }

    return (<Main className='max-w-3xl flex flex-col items-center pt-32'>
        <H usePlayfair>Fix. Your. Paper.</H>

        <Spacer y={3} />

        <p className={cn(ENGLISH_SERIF.className, 'text-center text-balance text-lg text-default-700')}>
            Quality papers are crafted with <span className='font-bold relative inline-block'>
                amiability
                <span className='absolute bottom-0 left-0 w-full h-1/2 bg-primary-200/40' />
            </span>. Not <span className='font-bold relative inline-block'>
                ambiguity
                <span className='absolute bottom-0 left-0 w-full h-1/2 bg-danger-200/40' />
            </span>.
        </p>

        <Spacer y={6} />

        <div className='space-y-6 w-full'>
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

            <Spacer y={8} />

            <div>
                <H usePlayfair disableCenter className='mb-4'>AI作答</H>
                <div className='max-w-none'>
                    <Markdown fontFamily={postFontFamily} md={paperAnalysis ?? '<article>\n> 未生成\n</article>'} />
                </div>
            </div>

            <Spacer y={6} />

            <div>
                <H usePlayfair disableCenter className='mb-4'>分析结果</H>
                <div className='max-w-none'>
                    <Markdown fontFamily={postFontFamily} md={result ?? '<article>\n> 未生成\n</article>'} />
                </div>
            </div>
        </div>
    </Main>)
} 