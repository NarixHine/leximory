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
                <p className='text-sm opacity-60'>选中文字以标注重点词</p>
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
                            setInput(editorText)
                            await setAnnotationProgressAction({ id: text, progress: 'annotating' })
                            setIsLoading(true)
                            onClose()
                            await generate({ article: editorText, textId: text, onlyComments: false })
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
                    <p className='text-sm opacity-60'>识别中……</p>
                </div>
            ) : (
                <FileUpload acceptableTypes={['image/png', 'image/jpeg', 'image/webp', 'image/gif']} onChange={async (files) => {
                    const file = files[files.length - 1]
                    if (!file.type.startsWith('image/')) {
                        toast.error('请上传图片文件')
                        return
                    }
                    startOcr(async () => {
                        const form = new FormData()
                        form.append('file', file)
                        try {
                            const result = await ocrClassicalChinese(form)
                            goToEditor(result)
                        } catch {
                            toast.error('识别失败，请重试')
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
                description='以 [[]] 包裹重点词'
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
