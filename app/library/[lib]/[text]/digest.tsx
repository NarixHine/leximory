'use client'

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { isEditingAtom, textAtom, ebookAtom, topicsAtom, lexiconAtom, displayedMdAtom, contentAtom } from './atoms'
import { langAtom } from '../atoms'
import { isReaderModeAtom } from '@/app/atoms'
import Ebook from './ebook'
import ImportModal from './import'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PiBookOpenDuotone, PiPrinterDuotone, PiPlusCircleDuotone, PiNotePencilDuotone, PiHeadphonesDuotone, PiMagnifyingGlassDuotone } from 'react-icons/pi'
import { saveContentAndTopics } from './actions'
import { Spacer } from '@nextui-org/spacer'
import { Divider } from '@nextui-org/divider'
import { Button } from '@nextui-org/button'
import { RadioGroup, Radio } from '@nextui-org/radio'
import { Tooltip } from '@nextui-org/tooltip'
import { Snippet } from '@nextui-org/snippet'
import { Input } from '@nextui-org/input'
import MdEditor from '@/components/editor'
import Topics from '@/components/topics'
import Markdown from '@/components/markdown'
import Define from './define'

function ReaderModeToggle() {
  const [isReaderMode, toggleReaderMode] = useAtom(isReaderModeAtom)

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
          onPress={() => toggleReaderMode()}
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

function LexiconSelector() {
  const [customLexicon, setCustomLexicon] = useAtom(lexiconAtom)

  return (
    <div className='flex justify-center items-center mb-1 sm:mb-0'>
      <RadioGroup
        value={customLexicon}
        orientation='horizontal'
        color='primary'
        onValueChange={(value) => { setCustomLexicon(value as CustomLexicon) }}
      >
        <Radio value='none'>无</Radio>
        <Radio value='chuzhong'>初中</Radio>
        <Radio value='gaozhong'>高中</Radio>
        <Radio value='cet6'>六级</Radio>
      </RadioGroup>
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

  return (
    <>
      <div className='flex space-x-3'>
        <Topics topics={modifiedTopics} remove={(topicToRemove) => {
          setModifiedTopics(modifiedTopics.filter(topic => topic !== topicToRemove))
        }} />
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
          onPress={() => {
            setModifiedTopics([...modifiedTopics, newTopic])
            setNewTopic('')
          }}
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
          renderHTML={(md) => <Markdown md={`<article>\n${md}\n</article>`} />}
          onChange={(e) => setModifiedMd(e.text)}
        />
      </div>
      <div className='hidden sm:block h-[500px]'>
        <MdEditor
          value={modifiedMd}
          className='h-full'
          renderHTML={(md) => <Markdown md={`<article>\n${md}\n</article>`} />}
          onChange={(e) => setModifiedMd(e.text)}
        />
      </div>
      <Spacer y={2} />
      <Button
        fullWidth
        variant='flat'
        color='secondary'
        onPress={async () => {
          await saveContentAndTopics(text, modifiedMd, modifiedTopics)
          setIsEditing(false)
          setContent(modifiedMd)
          setTopics(modifiedTopics)
        }}
      >
        保存更改
      </Button>
    </>
  )
}

function ReadingView() {
  const md = useAtomValue(displayedMdAtom)
  const isReaderMode = useAtomValue(isReaderModeAtom)

  if (!md) {
    return (
      <ul className='flex flex-col gap-1 align-middle justify-center items-center h-[calc(100dvh-500px)]'>
        <div>
          <li className='flex items-center gap-2'><PiNotePencilDuotone /><span className='font-bold'>制作词摘</span>强制注解<span className='font-mono'>[[]]</span>内词汇</li>
          <li className='flex items-center gap-2'><PiPrinterDuotone /><span className='font-bold'>导出打印</span>印刷模式下按<span className='font-mono'>Ctrl + P</span></li>
          <li className='flex items-center gap-2'><PiHeadphonesDuotone /><span className='font-bold'>边听边读</span><span><Link className='underline decoration-1 underline-offset-2' href='/blog/reading-while-listening'>培养</Link>多维度语言认知</span></li>
          <li className='flex items-center gap-2'><PiMagnifyingGlassDuotone /><span className='font-bold'>动态注解</span>长按点选查询任意单词</li>
        </div>
      </ul>
    )
  }

  return (
    <>
      <Markdown
        className={isReaderMode ? 'w-3/5 block' : 'max-w-[650px] mx-auto block px-4 sm:px-0'}
        md={`<article>\n${md}\n</article>`}
      />
      <Define />
    </>
  )
}

export default function Digest() {
  const isEditing = useAtomValue(isEditingAtom)
  const ebook = useAtomValue(ebookAtom)
  const lang = useAtomValue(langAtom)
  const isReaderMode = useAtomValue(isReaderModeAtom)

  return (
    <>
      <div className='sm:mt-4 sm:flex sm:justify-center sm:items-center mb-2.5'>
        {!ebook && (
          <div className='sm:flex sm:justify-center sm:items-center sm:space-x-4'>
            <ReaderModeToggle />
            {lang === 'en' && !isReaderMode && <LexiconSelector />}
          </div>
        )}
      </div>

      {ebook ? (
        <Ebook />
      ) : isEditing ? (
        <EditingView />
      ) : (
        <ReadingView />
      )}

      <div className={isReaderMode ? '' : 'max-w-[650px] mx-auto'}>
        {!isReaderMode && (
          <>
            <Spacer y={3} />
            <Divider />
            <Spacer y={3} />
            <ImportModal />
          </>
        )}
      </div>
    </>
  )
}
