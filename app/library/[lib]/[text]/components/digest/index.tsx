'use client'

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { isEditingAtom, textAtom, ebookAtom, topicsAtom, contentAtom, titleAtom, hideTextAtom, isLoadingAtom } from '../../atoms'
import { langAtom, libAtom, visitedTextsAtom } from '../../../atoms'
import { isReaderModeAtom } from '@/app/atoms'
import Ebook from './ebook'
import { Button } from "@heroui/button"
import { Alert } from "@heroui/alert"
import { Spacer } from "@heroui/spacer"
import { Input } from "@heroui/input"
import { Tooltip } from "@heroui/tooltip"
import { Snippet } from "@heroui/snippet"
import ImportModal from './import'
import { useEffect, useState, useCallback, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { PiPrinterDuotone, PiPlusCircleDuotone, PiNotePencilDuotone, PiHeadphonesDuotone, PiMagnifyingGlassDuotone, PiPencilCircleDuotone, PiBookBookmarkDuotone, PiTrashDuotone, PiChatDotsDuotone, PiBellDuotone } from 'react-icons/pi'
import Editor from '../editor'
import Topics from '../topics'
import Markdown from '@/components/markdown'
import Define from '@/components/define'
import LexiconSelector from '@/components/lexicon'
import { cn } from '@/lib/utils'
import { contentFontFamily } from '@/lib/fonts'
import { recentAccessAtom } from '@/app/library/components/lib'
import { getAnnotationProgress, getNewText, remove, save } from '../../actions'
import { useTransitionRouter } from 'next-view-transitions'
import { AnnotationProgress } from '@/lib/types'
import { useInterval } from 'usehooks-ts'
import { Progress } from '@heroui/progress'

function ReaderModeToggle() {
  const [isReaderMode, toggleReaderMode] = useAtom(isReaderModeAtom)
  const setIsEditing = useSetAtom(isEditingAtom)

  return (
    <div className={cn(
      isReaderMode ? 'w-full flex justify-center' : 'w-full flex justify-center my-2 sm:mt-0 sm:mb-0 sm:w-fit',
      'print:hidden'
    )}>
      <Tooltip content={
        <div>
          按 <Snippet hideCopyButton symbol='' className='bg-transparent'>
            Ctrl + P
          </Snippet> 打印
        </div>
      }>
        <Button
          onPress={() => {
            if (!isReaderMode) {
              setTimeout(print, 500)
            }
            toggleReaderMode()
            setIsEditing(false)
          }}
          className='mx-auto'
          variant={'light'}
          color={'default'}
          radius='sm'
          startContent={<PiPrinterDuotone />}
        >
          印刷模式
        </Button>
      </Tooltip>
    </div>
  )
}

function EditingView() {
  const text = useAtomValue(textAtom)
  const lib = useAtomValue(libAtom)
  const [topics, setTopics] = useAtom(topicsAtom)
  const [content, setContent] = useAtom(contentAtom)
  const setIsEditing = useSetAtom(isEditingAtom)
  const title = useAtomValue(titleAtom)

  const [modifiedMd, setModifiedMd] = useState(content)
  const [modifiedTopics, setModifiedTopics] = useState(topics)
  const [newTopic, setNewTopic] = useState('')

  const [isUpdating, startUpdating] = useTransition()

  useEffect(() => {
    setModifiedMd(content)
    setModifiedTopics(topics)
  }, [content, topics])

  const handleTopicRemove = useCallback((topicToRemove: string) => {
    setModifiedTopics(prevTopics => prevTopics.filter(topic => topic !== topicToRemove))
  }, [])

  const handleAddTopic = useCallback(() => {
    setModifiedTopics(prevTopics => [...prevTopics, newTopic])
    setNewTopic('')
  }, [newTopic])

  const handleSaveChanges = useCallback(async () => {
    startUpdating(async () => {
      await save({ id: text, content: modifiedMd, topics: modifiedTopics, title: title })
      setIsEditing(false)
      setContent(modifiedMd)
      setTopics(modifiedTopics)
    })
  }, [text, modifiedMd, modifiedTopics, setIsEditing, setContent, setTopics, title])

  const memoizedTopics = useMemo(() => (
    <Topics topics={modifiedTopics} remove={handleTopicRemove} />
  ), [modifiedTopics, handleTopicRemove])

  const router = useTransitionRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const handleDeleteText = useCallback(async () => {
    setIsDeleting(true)
    await remove({ id: text })
    router.push(`/library/${lib}`)
    setIsDeleting(false)
  }, [text, lib])

  return (
    <>
      <div className='flex space-x-3'>
        {memoizedTopics}
        <div className='flex-1'>
          <Input
            className='w-full'
            variant='underlined'
            color='secondary'
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
          />
        </div>
        <Button
          variant='flat'
          color='secondary'
          startContent={<PiPlusCircleDuotone />}
          onPress={handleAddTopic}
        >
          添加
        </Button>
      </div>
      <Spacer y={2} />
      <div className='sm:hidden h-[500px]'>
        <Editor
          value={modifiedMd}
          className='h-full'
          view={{ menu: true, md: true, html: false }}
          renderHTML={(md) => <Markdown md={`<article>\n${md}\n\n</article>`} />}
          onChange={(e) => setModifiedMd(e.text)}
        />
      </div>
      <div className='hidden sm:block h-[500px]'>
        <Editor
          value={modifiedMd}
          className='h-full'
          renderHTML={(md) => <Markdown md={`<article>\n${md}\n\n</article>`} />}
          onChange={(e) => setModifiedMd(e.text)}
        />
      </div>
      <Spacer y={2} />
      <div className='flex gap-2'>
        <Button
          className='flex-1'
          isLoading={isUpdating}
          isDisabled={isDeleting}
          variant='flat'
          color='primary'
          startContent={<PiPencilCircleDuotone />}
          onPress={handleSaveChanges}
        >
          保存更改
        </Button>
        <Button
          isLoading={isDeleting}
          isDisabled={isUpdating}
          variant='flat'
          color='danger'
          onPress={handleDeleteText}
          startContent={<PiTrashDuotone />}
          isIconOnly
        ></Button>
      </div>
    </>
  )
}

function ReadingView() {
  const content = useAtomValue(contentAtom)
  const isReaderMode = useAtomValue(isReaderModeAtom)
  const ebook = useAtomValue(ebookAtom)
  const hideText = useAtomValue(hideTextAtom)
  const lang = useAtomValue(langAtom)

  if (hideText && content) {
    const matches = content.match(/\{\{([^|}]+)(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?\}\}/g) || []
    return (
      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4'>
        {matches.map((match, index) => (
          <div key={index} className='flex justify-center'>
            <Markdown md={match} onlyComments shadow />
          </div>
        ))}
      </div>
    )
  }

  if (!content) {
    return (
      <ul className={cn('flex flex-col gap-1 align-middle justify-center items-center', !ebook && 'h-[calc(100dvh-350px)]')}>
        {ebook
          ? <Alert description='保存的文摘会显示于此' icon={<PiBookBookmarkDuotone />} color='primary' variant='bordered' classNames={{ title: cn('text-md'), base: 'max-w-[650px] mx-auto', description: cn('text-xs'), alertIcon: 'text-lg' }} title='文摘'></Alert>
          : <div>
            <li className='flex items-center gap-2'><PiNotePencilDuotone /><span className='font-bold'>制作词摘</span>强制注解<span className='font-mono'>[[]]</span>内词汇</li>
            <li className='flex items-center gap-2'><PiPrinterDuotone /><span className='font-bold'>导出打印</span>印刷模式下按<span className='font-mono'>Ctrl + P</span></li>
            <li className='flex items-center gap-2'><PiHeadphonesDuotone /><span className='font-bold'>边听边读</span><span><Link className='underline decoration-1 underline-offset-2' href='/blog/reading-while-listening'>培养</Link>多维度语言认知</span></li>
            <li className='flex items-center gap-2'><PiMagnifyingGlassDuotone /><span className='font-bold'>动态注解</span>长按点选查询任意单词</li>
          </div>}
      </ul>
    )
  }

  return (
    <>
      <Markdown
        className={cn(
          isReaderMode ? 'w-3/5 block' : 'max-w-[650px] mx-auto block px-4 sm:px-0',
          '!prose-lg text-pretty'
        )}
        fontFamily={lang === 'en' ? contentFontFamily : undefined}
        md={`<article>${content}</article>`}
      />
      <Define />
    </>
  )
}

function GeneratingView() {
  const [annotationProgress, setAnnotationProgress] = useState<AnnotationProgress>('annotating')
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom)
  const setContent = useSetAtom(contentAtom)
  const setTopics = useSetAtom(topicsAtom)
  const text = useAtomValue(textAtom)
  const [currentProgress, setCurrentProgress] = useState(0)

  const targetProgressRecord: Record<AnnotationProgress, number> = {
    'annotating': 60,
    'saving': 95,
    'completed': 100
  }

  const startProgressRecord: Record<AnnotationProgress, number> = {
    'annotating': 0,
    'saving': 80,
    'completed': 95
  }

  useInterval(() => {
    if (currentProgress < targetProgressRecord[annotationProgress]) {
      const remaining = targetProgressRecord[annotationProgress] - currentProgress
      const baseIncrement = 3
      const increment = Math.max(0.4, (baseIncrement * remaining) / targetProgressRecord[annotationProgress])
      setCurrentProgress(prev => Math.min(prev + increment, targetProgressRecord[annotationProgress]))
    }
  }, 1000)

  useInterval(() => {
    getAnnotationProgress(text).then(newProgress => {
      if (!newProgress) {
        setAnnotationProgress('annotating')
        return
      }
      if (annotationProgress !== newProgress) {
        setCurrentProgress(startProgressRecord[newProgress])
        if (newProgress === 'completed') {
          getNewText(text).then(({ content, topics }) => {
            setContent(content)
            setTopics(topics ?? [])
            setIsLoading(false)
          })
        }
        setAnnotationProgress(newProgress)
      }
    })
  }, isLoading ? 1000 : null)

  const progressLabel: Record<AnnotationProgress, string> = {
    annotating: '生成注解中……',
    saving: '保存中……',
    completed: '完成'
  }

  return (
    <div className='flex flex-col justify-center items-center h-[calc(100dvh-350px)] gap-4'>
      <Progress
        classNames={{ label: cn('text-md') }}
        color='primary'
        size='lg'
        value={currentProgress}
        label={progressLabel[annotationProgress]}
      />
      <ul className={cn('flex flex-col gap-1 align-middle justify-center items-center', 'h-[calc(100dvh-350px)]', 'text-md')}>
        <li className='flex items-center gap-2'><PiChatDotsDuotone /><span>生成完成后注解版会自动出现</span></li>
        <li className='flex items-center gap-2'><PiBellDuotone /><span>开启<Link className='underline decoration-1 underline-offset-4' href='/daily'>通知</Link>以立刻接收生成结果</span></li>
      </ul>
    </div>
  )
}

export default function Digest() {
  const isEditing = useAtomValue(isEditingAtom)
  const ebook = useAtomValue(ebookAtom)
  const lang = useAtomValue(langAtom)
  const isReaderMode = useAtomValue(isReaderModeAtom)
  const isLoading = useAtomValue(isLoadingAtom)
  const lib = useAtomValue(libAtom)
  const text = useAtomValue(textAtom)
  const [recentAccess, setRecentAccess] = useAtom(recentAccessAtom)
  const title = useAtomValue(titleAtom)
  const [visitedTexts, setVisitedTexts] = useAtom(visitedTextsAtom)
  useEffect(() => {
    const newRecentAccess = { ...recentAccess }
    newRecentAccess[lib] = { id: text, title }
    setRecentAccess(newRecentAccess)
    const timer = setTimeout(() => {
      const newVisitedTexts = { ...visitedTexts }
      newVisitedTexts[text] = true
      setVisitedTexts(newVisitedTexts)
    }, 60 * 1000)
    return () => clearTimeout(timer)
  }, [lib, text, title])

  return (
    <div className='min-h-[calc(100dvh-240px)] md:min-h-[calc(100dvh-160px)] flex flex-col'>
      <div className='sm:mt-4 sm:flex sm:justify-center sm:items-center mb-2.5 opacity-75'>
        {!ebook && (
          <div className='sm:flex sm:justify-center sm:items-center sm:space-x-4'>
            <ReaderModeToggle />
            {lang === 'en' && !isReaderMode && <LexiconSelector className='mb-1 sm:mb-0' />}
          </div>
        )}
      </div>

      <div className='flex-1'>
        {isLoading ? (
          <GeneratingView />
        ) : isEditing ? (
          <EditingView />
        ) : (
          <>
            {ebook && <Ebook />}
            <ReadingView />
          </>
        )}
      </div>

      {!isReaderMode && <div className={'max-w-[650px] mx-auto'}>
        <Spacer y={6} />
        <ImportModal />
      </div>}
    </div>
  )
}