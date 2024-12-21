'use client'

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { isEditingAtom, textAtom, ebookAtom, topicsAtom, displayedMdAtom, contentAtom, titleAtom, recentWordsAtom, hideTextAtom } from './atoms'
import { langAtom, libAtom } from '../atoms'
import { isReaderModeAtom } from '@/app/atoms'
import Ebook from './ebook'
import { Button } from '@nextui-org/button'
import { Alert } from '@nextui-org/alert'
import { Spacer } from '@nextui-org/spacer'
import { Input } from '@nextui-org/input'
import { Tooltip } from '@nextui-org/tooltip'
import { Snippet } from '@nextui-org/snippet'
import { Badge } from '@nextui-org/badge'
import { Popover, PopoverTrigger, PopoverContent } from '@nextui-org/popover'
import ImportModal from './import'
import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { PiBookOpenDuotone, PiKanbanDuotone, PiPrinterDuotone, PiPlusCircleDuotone, PiNotePencilDuotone, PiHeadphonesDuotone, PiMagnifyingGlassDuotone, PiPencilCircleDuotone, PiBookBookmarkDuotone } from 'react-icons/pi'
import { saveContentAndTopics } from './actions'
import MdEditor from '@/components/editor'
import Topics from '@/components/topics'
import Markdown from '@/components/markdown'
import Define from './define'
import LexiconSelector from '@/components/lexicon'
import { recentAccessAtom } from '@/components/library'
import { cn } from '@/lib/utils'
import { CHINESE_ZCOOL } from '@/lib/fonts'

function ReaderModeToggle() {
  const [isReaderMode, toggleReaderMode] = useAtom(isReaderModeAtom)
  const setIsEditing = useSetAtom(isEditingAtom)

  return (
    <div className={isReaderMode ? 'w-full flex justify-center' : 'w-full flex justify-center mb-1 mt-2 sm:mt-0 sm:mb-0 sm:w-fit'}>
      <Tooltip content={
        <div>
          按 <Snippet hideCopyButton symbol='' className='bg-transparent'>
            Ctrl + P
          </Snippet> 打印
        </div>
      }>
        <Button
          onPress={() => {
            toggleReaderMode()
            setIsEditing(false)
          }}
          className='mx-auto'
          variant={'light'}
          color={isReaderMode ? 'default' : 'primary'}
          radius='sm'
          endContent={<PiPrinterDuotone />}
          startContent={<PiBookOpenDuotone />}
        >
          读者模式／印刷模式
        </Button>
      </Tooltip>
    </div>
  )
}

function EditingView() {
  const text = useAtomValue(textAtom)
  const [topics, setTopics] = useAtom(topicsAtom)
  const md = useAtomValue(displayedMdAtom)
  const setContent = useSetAtom(contentAtom)
  const setIsEditing = useSetAtom(isEditingAtom)

  const [modifiedMd, setModifiedMd] = useState(md)
  const [modifiedTopics, setModifiedTopics] = useState(topics)
  const [newTopic, setNewTopic] = useState('')

  useEffect(() => {
    setModifiedMd(md)
    setModifiedTopics(topics)
  }, [md, topics])

  const handleTopicRemove = useCallback((topicToRemove: string) => {
    setModifiedTopics(prevTopics => prevTopics.filter(topic => topic !== topicToRemove))
  }, [])

  const handleAddTopic = useCallback(() => {
    setModifiedTopics(prevTopics => [...prevTopics, newTopic])
    setNewTopic('')
  }, [newTopic])

  const handleSaveChanges = useCallback(async () => {
    await saveContentAndTopics(text, modifiedMd, modifiedTopics)
    setIsEditing(false)
    setContent(modifiedMd)
    setTopics(modifiedTopics)
  }, [text, modifiedMd, modifiedTopics, setIsEditing, setContent, setTopics])

  const memoizedTopics = useMemo(() => (
    <Topics topics={modifiedTopics} remove={handleTopicRemove} />
  ), [modifiedTopics, handleTopicRemove])

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
        <MdEditor
          value={modifiedMd}
          className='h-full'
          view={{ menu: true, md: true, html: false }}
          renderHTML={(md) => <Markdown md={`<article>\n${md}\n\n</article>`} />}
          onChange={(e) => setModifiedMd(e.text)}
        />
      </div>
      <div className='hidden sm:block h-[500px]'>
        <MdEditor
          value={modifiedMd}
          className='h-full'
          renderHTML={(md) => <Markdown md={`<article>\n${md}\n\n</article>`} />}
          onChange={(e) => setModifiedMd(e.text)}
        />
      </div>
      <Spacer y={2} />
      <Button
        fullWidth
        variant='flat'
        color='secondary'
        startContent={<PiPencilCircleDuotone />}
        onPress={handleSaveChanges}
      >
        保存更改
      </Button>
    </>
  )
}

function ReadingView() {
  const md = useAtomValue(displayedMdAtom)
  const isReaderMode = useAtomValue(isReaderModeAtom)
  const ebook = useAtomValue(ebookAtom)
  const hideText = useAtomValue(hideTextAtom)

  if (hideText && md) {
    const matches = md?.match(/\{\{([^|}]+)(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?(?:\|\|([^|}]+))?\}\}/g) || []
    return (
      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4'>
        {matches.map((match, index) => (
          <div key={index} className='flex justify-center'>
            <Markdown md={match} onlyComments />
          </div>
        ))}
      </div>
    )
  }

  if (!md) {
    return (
      <ul className='flex flex-col gap-1 align-middle justify-center items-center'>
        {ebook
          ? <Alert icon={<PiBookBookmarkDuotone />} variant='bordered' classNames={{ title: cn(CHINESE_ZCOOL.className, 'text-md'), base: 'max-w-[650px] mx-auto' }} title='保存的文摘会显示于此'></Alert>
          : <div className='h-[calc(100dvh-500px)]'>
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
        className={isReaderMode ? 'w-3/5 block' : 'max-w-[650px] mx-auto block px-4 sm:px-0'}
        md={`<article>\n${md}\n\n</article>`}
      />
      <Define />
    </>
  )
}

function QuickReview() {
  const [recentWords] = useAtom(recentWordsAtom)
  const [isOpen, setIsOpen] = useState(false)

  if (recentWords.length === 0) return null

  return (
    <div className='fixed bottom-4 right-4 z-50'>
      <Popover
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        placement='top-end'
        shadow='sm'
      >
        <PopoverTrigger>
          <Badge
            content={recentWords.length}
            color='secondary'
            variant='flat'
          >
            <Button
              isIconOnly
              onPress={() => setIsOpen(true)}
              variant='flat'
              color='secondary'
              startContent={<PiKanbanDuotone />}
            >
            </Button>
          </Badge>
        </PopoverTrigger>
        <PopoverContent className='p-5 max-w-80'>
          <div className='flex justify-between items-center mb-2'>
            <span className='text-sm text-gray-500'>
              本次阅读保存词汇
            </span>
          </div>
          <div className='flex flex-wrap gap-3 w-full justify-center'>
            {recentWords.map((word) => (
              <Markdown
                key={word[0]}
                disableSave
                md={`{{${word.join('||')}}}`}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default function Digest() {
  const isEditing = useAtomValue(isEditingAtom)
  const ebook = useAtomValue(ebookAtom)
  const lang = useAtomValue(langAtom)
  const isReaderMode = useAtomValue(isReaderModeAtom)

  const lib = useAtomValue(libAtom)
  const text = useAtomValue(textAtom)
  const [recentAccess, setRecentAccess] = useAtom(recentAccessAtom)
  const title = useAtomValue(titleAtom)
  useEffect(() => {
    const newRecentAccess = { ...recentAccess }
    newRecentAccess[lib] = { id: text, title }
    setRecentAccess(newRecentAccess)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, text, title])

  return (
    <>
      <div className='sm:mt-4 sm:flex sm:justify-center sm:items-center mb-2.5'>
        {!ebook && (
          <div className='sm:flex sm:justify-center sm:items-center sm:space-x-4'>
            <ReaderModeToggle />
            {lang === 'en' && !isReaderMode && <LexiconSelector className='mb-1 sm:mb-0' />}
          </div>
        )}
      </div>

      {isEditing ? (
        <EditingView />
      ) : (
        <>
          {ebook && <Ebook />}
          <ReadingView />
        </>
      )}

      <div className={isReaderMode ? '' : 'max-w-[650px] mx-auto'}>
        {!isReaderMode && (
          <>
            <Spacer y={4} />
            <ImportModal />
            <QuickReview />
          </>
        )}
      </div>
    </>
  )
}