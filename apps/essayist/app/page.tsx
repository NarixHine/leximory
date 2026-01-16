'use client'

import Main from '@/components/main'
import EssayistTitle from '@/components/title'
import AnalyseButton from '@/components/analyse-button'
import ScoreDisplay from '@/components/score-display'
import { Textarea } from '@heroui/input'
import OriginalArticle from '@/components/original-article'
import AnalysisResults from '@/components/analysis-results'
import { analyzeText, getScores } from '@/app/actions'
import { useState, useTransition } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Button } from '@heroui/button'

export default function Page() {
  const [isFocused, setIsFocused] = useState(false)
  const [isAnalysing, setIsAnalysing] = useState(false)
  const [text, setText] = useState(`Dear Students’ Union,

I am Li Hua from Senior Three. I know the school wants to use tablets instead of paper books. I do not agree with this idea.

First, using tablets is bad for our eyes. We already look at screens for a long time every day. If we also read books on tablets, our eyes will be more tired, and some students may get poor eyesight. This is not good for our health.

Second, not all students are good at using electronic devices. Some students may be slow or make mistakes when using tablets, so they cannot study well. Also, if the tablet is broken, it will bring trouble to learning.

In my opinion, paper books are still better for us. I hope the school can think about this plan again.

Yours,

Li Hua`)
  const [requirements, setRequirements] = useState('假设你是明启中学高三学生李华。学校正计划将全校印刷教材改为统一配发的电子平板，同时有同学担心使用电子教材会增加用眼负担；也有同学认为它能提高学习效率。  请给学校学生会写一封邮件，内容须包括：\n1.你对此方案的明确态度； \n2.说明你选择该态度的两个主要理由。')
  const [scores, setScores] = useState<(number | undefined)[]>([])
  const [correctedText, setCorrectedText] = useState('')
  const [highlights, setHighlights] = useState<Array<{
    text: string | undefined
    type: 'bad' | 'good' | undefined
    details: string | undefined
  }>>([])
  const [isPending, startTransition] = useTransition()
  const [editedText, setEditedText] = useState('')

  const handleReset = () => {
    setIsAnalysing(false)
    setText('')
    setScores([])
    setCorrectedText('')
    setHighlights([])
    setRequirements('')
  }
  
  const handleFocus = () => setIsFocused(true)
  const handleAnalyse = () => {
    setIsAnalysing(true)
    setEditedText(text)

    startTransition(async () => {
      async function markEssay() {
        const scoresResult = await getScores(requirements, text)
        for await (const partialObject of scoresResult) {
          setScores(partialObject.score ?? [])
        }
      }

      async function analyzeEssay() {
        const result = await analyzeText(requirements, text)
        for await (const partialObject of result) {
          const { corrected, goodPairs, badPairs } = partialObject
          const badHighlights = badPairs?.filter(pair => pair && pair.original && pair.improved).map(pair => ({ text: pair!.original, type: 'bad' as const, details: pair!.improved }))
          const goodHighlights = goodPairs?.filter(pair => pair && pair.original && pair.why).map(pair => ({ text: pair!.original, type: 'good' as const, details: pair!.why }))
          setHighlights([...(badHighlights ?? []), ...(goodHighlights ?? [])])
          if (corrected) {
            setCorrectedText(corrected)
          }
        }
      }

      await Promise.all([markEssay(), analyzeEssay()])
    })
  }

  const handleReAnalyse = (newText: string) => {
    setText(newText)
    setScores([])

    startTransition(async () => {
      async function markEssay() {
        const scoresResult = await getScores(requirements, newText)
        for await (const partialObject of scoresResult) {
          setScores(partialObject.score ?? [])
        }
      }

      async function analyzeEssay() {
        const result = await analyzeText(requirements, newText)
        for await (const partialObject of result) {
          const { corrected, goodPairs, badPairs } = partialObject
          const badHighlights = badPairs?.filter(pair => pair && pair.original && pair.improved).map(pair => ({ text: pair!.original, type: 'bad' as const, details: pair!.improved }))
          const goodHighlights = goodPairs?.filter(pair => pair && pair.original && pair.why).map(pair => ({ text: pair!.original, type: 'good' as const, details: pair!.why }))
          setHighlights([...(badHighlights ?? []), ...(goodHighlights ?? [])])
          if (corrected) {
            setCorrectedText(corrected)
          }
        }
      }

      await Promise.all([markEssay(), analyzeEssay()])
      setText(newText)
    })
  }

  return <Main className='flex flex-col min-h-dvh'>
    <div className='flex items-center gap-4 p-4'>
      <AnimatePresence mode='wait'>
        {!isFocused && <EssayistTitle key='title' />}
        {isFocused && !isAnalysing && <AnalyseButton key='button' onPress={handleAnalyse} />}
        {isAnalysing && <ScoreDisplay key='scores' scores={scores} isPending={isPending} onTryAnother={handleReset} />}
      </AnimatePresence>
    </div>

    <div className='flex-1 pb-4 px-4'>
      {!isAnalysing ? (
        <div className='mb-4 gap-4 flex flex-col md:flex-row md:gap-8'>
          <Textarea
            value={text}
            variant='underlined'
            onChange={(e) => setText(e.target.value)}
            onFocus={handleFocus}
            label='Enter your essay here.'
            className='w-full mx-auto'
            minRows={20}
            maxRows={40}
          />
          <Textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            onFocus={handleFocus}
            variant='underlined'
            label='Guided Writing requirements here.'
            minRows={5}
            maxRows={40}
          />
        </div>
      ) : (
        <div className={`w-full flex ${isAnalysing ? 'flex-col md:flex-row' : 'flex-col'} gap-4`}>
          <div className='flex-1'>
            <h2 className='text-xl font-semibold mb-2'>Your Essay</h2>
            <OriginalArticle text={text} highlights={highlights.filter(h => h.text && h.type && h.details) as { text: string; type: 'bad' | 'good'; details: string }[]} />
          </div>
          <AnalysisResults correctedText={correctedText} />
          <div className='order-last md:order-first flex-1 space-y-4'>
            <h2 className='text-xl font-semibold mb-2'>Edit and Try Again</h2>
            <Textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              variant='underlined'
              classNames={{
                input: 'text-medium leading-[1.7]',
              }}
              placeholder='Edit your essay for second edition analysis'
              minRows={10}
              maxRows={Infinity}
            />
            <Button onPress={() => handleReAnalyse(editedText)} color='primary'>Submit Polished Edition</Button>
          </div>
        </div>
      )}
    </div>
  </Main>
}
