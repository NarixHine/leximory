'use client'

import { useState, useTransition } from 'react'
import { Button } from '@heroui/button'
import { Textarea } from '@heroui/input'
import { Divider } from '@heroui/divider'
import { Spinner } from '@heroui/spinner'
import { toast } from 'sonner'
import { FileUpload } from '@/components/ui/upload'
import { ocrClassicalChinese, generate, setAnnotationProgressAction } from '@/service/text'
import { PiAirplaneInFlight, PiArrowRight } from 'react-icons/pi'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { inputAtom, isLoadingAtom, textAtom } from '../../atoms'
import PhotoEditor from './photo-editor'

export default function PhotoImportTab({ onClose }: { onClose: () => void }) {
    const [step, setStep] = useState<'upload' | 'edit'>('upload')
    const [pastedText, setPastedText] = useState('')
    const [editorText, setEditorText] = useState('')
    const [isOcring, startOcr] = useTransition()
    const text = useAtomValue(textAtom)
    const setInput = useSetAtom(inputAtom)
    const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
    const [isGenerating, startGenerating] = useTransition()

    const goToEditor = (content: string) => {
        setEditorText(content)
        setStep('edit')
    }

    if (step === 'edit') {
        return (
            <div className='flex flex-col gap-3'>
                <p className='text-sm opacity-60'>选中以强制注释词汇</p>
                <div className='border border-default-200 rounded-2xl p-4 max-h-80 overflow-y-auto'>
                    <PhotoEditor
                        initialText={editorText}
                        onChange={setEditorText}
                    />
                </div>
                <Button
                    className='mt-2'
                    color='primary'
                    fullWidth
                    startContent={<PiAirplaneInFlight className='text-xl' />}
                    isDisabled={isLoading || !editorText.trim() || isGenerating}
                    onPress={() => {
                        startGenerating(async () => {
                            try {
                                setInput(editorText)
                                await setAnnotationProgressAction({ id: text, progress: 'annotating' })
                                setIsLoading(true)
                                onClose()
                                await generate({ article: editorText, textId: text, onlyComments: false })
                            } catch (error) {
                                setIsLoading(false)
                                toast.error('生成失败，请稍后重试')
                            }
                        })
                    }}>
                    生成
                </Button>
            </div>
        )
    }

    return (
        <div className='flex flex-col gap-2'>
            <p className='text-center font-bold text-xl -mb-10'>上传文言文图片</p>
            {isOcring ? (
                <div className='flex flex-col items-center justify-center py-16 gap-3'>
                    <Spinner color='secondary' size='lg' />
                </div>
            ) : (
                <FileUpload acceptableTypes={['image/png', 'image/jpeg', 'image/webp', 'image/gif']} onChange={async (files) => {
                    if (!files.length) return
                    const file = files[files.length - 1]
                    startOcr(async () => {
                        const form = new FormData()
                        form.append('file', file)
                        try {
                            const result = await ocrClassicalChinese(form)
                            const trimmed = result.trim()
                            if (!trimmed) {
                                toast.error('未在图片中识别到文本，请尝试另一张图片或手动粘贴')
                                return
                            }
                            goToEditor(trimmed)
                        } catch (e) {
                            const msg = e instanceof Error ? e.message : ''
                            toast.error(
                                msg === 'Quota exceeded' ? '额度已耗尽' :
                                msg === 'File too large' ? '图片文件过大' :
                                '识别失败，请重试'
                            )
                        }
                    })
                }} />
            )}
            <div className='flex gap-2 -mt-2 mb-2 items-center'>
                <Divider className='flex-1' />
                <span className='opacity-60'>或</span>
                <Divider className='flex-1' />
            </div>
            <Textarea
                value={pastedText}
                label='粘贴文本'
                rows={4}
                onValueChange={setPastedText}
                disableAutosize
            />
            <Button
                className='mt-1'
                color='secondary'
                variant='flat'
                fullWidth
                startContent={<PiArrowRight className='text-lg' />}
                isDisabled={!pastedText.trim()}
                onPress={() => goToEditor(pastedText)}>
                下一步
            </Button>
        </div>
    )
}
