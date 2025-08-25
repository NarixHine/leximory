'use client'

import Main from '@/components/ui/main'
import { PiSealQuestionDuotone, PiOptionDuotone, PiMagicWandDuotone } from 'react-icons/pi'
import { useLocalStorage } from 'usehooks-ts'
import Paper from '..'
import Sortable from './sortable'
import QuizData from '../generators/types'
import Editor from './editor'
import { questionStrategies } from '../generators/strategies'

export default function Editory({ data, id }: { data?: QuizData[] | null, id?: string }) {
  const [items, setItems] = useLocalStorage<QuizData[]>('editory-paper', data ?? (['grammar', 'fishing', 'cloze'] as const).map((type) => questionStrategies[type].getDefaultValue()))

  return (
    <Main className='max-w-screen px-0'>
      <div className='gap-4 flex-col md:flex-row flex w-full'>
        <section className='flex basis-7/12 shrink-0'>
          <div className='flex flex-col gap-2 p-4 text-end w-min min-w-50'>
            
            <h2 className='font-bold text-4xl text-primary-300 mt-8'>Editor</h2>

            <div className='flex flex-col gap-2 text-sm text-primary-400/70 w-29 self-end'>
              <div className='flex items-center gap-2'>
                <div>
                  <PiSealQuestionDuotone />
                </div>
                <hr className='flex-1 border-t-primary-400/70 border-t-1' />
                <div>
                  blanking
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <div>
                  <PiOptionDuotone />
                </div>
                <hr className='flex-1 border-t-primary-400/70 border-t-1' />
                <div>
                  options
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <div>
                  <PiMagicWandDuotone />
                </div>
                <hr className='flex-1 border-t-primary-400/70 border-t-1' />
                <div>
                  AI draft
                </div>
              </div>
            </div>

            <div className='flex flex-col gap-2'>
              <p className='text-sm text-default-800/50 text-balance'>
                <span className='font-bold'>Select a word</span> to blank it
              </p>
              <p className='text-xs text-balance font-mono text-danger-200'>
                Active maintenance for Editory has paused.
                The now closed site has been moved here only as a snapshot that may still be of use.
              </p>
            </div>
          </div>

          <Editor items={items} setItems={setItems} id={id} />
        </section>

        <div className='flex flex-col items-center gap-2 basis-5/12 pt-8'>
          <Sortable items={items} setItems={setItems} />

          <section className='w-full'>
            <div className='flex items-center'>
              <h2 className='font-bold text-4xl pt-6 pb-4'>Paper</h2>
            </div>
            <div className='border-primary-400/20 border-4 px-4 pb-3 rounded'>
              <Paper data={items} />
            </div>
          </section>
        </div>
      </div>
    </Main>
  )
}
