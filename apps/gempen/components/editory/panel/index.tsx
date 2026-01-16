'use client'

import { SealQuestionIcon, OptionIcon, MagicWandIcon } from '@phosphor-icons/react'
import { Key, Paper } from '..'
import Sortable from './sortable'
import Editor from './editor'
import { JsonEditor } from './json-editor'
import { ImportButton } from './import'
import { useAtomValue } from 'jotai'
import { editoryItemsAtom } from '../atoms'
import { ReviseAllButton } from './editor/revise-paper/revise-all-button'
import { Copyright } from './copyright'

export default function Editory({ id }: { id?: string }) {
  const data = useAtomValue(editoryItemsAtom)

  return (
    <div className='gap-4 flex-col lg:flex-row flex'>
      <section className='flex flex-col sm:flex-row sm:basis-7/12 shrink-0'>
        <div className='p-4 flex flex-col space-y-3 items-end'>
          <div className='flex flex-row items-center justify-between sm:items-end sm:justify-normal sm:flex-col w-full gap-2 sm:w-min min-w-50'>
            <h2 className='font-bold text-5xl text-secondary-300 sm:mt-8'>
              Editor
            </h2>

            <div className='flex flex-col gap-2 text-sm text-secondary-400/70 w-32 self-end shrink sm:shrink-0'>
              <div className='flex items-center gap-2'>
                <div>
                  <SealQuestionIcon weight='fill' />
                </div>
                <hr className='flex-1 border-t-secondary-400/70 border-t-1' />
                <div>
                  挖空词句
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <div>
                  <OptionIcon weight='fill' />
                </div>
                <hr className='flex-1 border-t-secondary-400/70 border-t-1' />
                <div>
                  具体设置
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <div>
                  <MagicWandIcon weight='fill' />
                </div>
                <hr className='flex-1 border-t-secondary-400/70 border-t-1' />
                <div>
                  智能出题
                </div>
              </div>
            </div>

            <div className='flex flex-col gap-2'>
              <p className='text-sm text-default-800/50 text-balance text-center sm:text-end'>
                <span className='font-bold'>选中</span>以唤起悬浮菜单
              </p>
            </div>
          </div>

          <div className='flex justify-end lg:pl-4 gap-2 flex-col sm:flex-wrap sm:justify-end w-full'>
            <ImportButton />
            <ReviseAllButton />
          </div>

          <div className='hidden sm:flex justify-end mt-auto'>
            <Copyright />
          </div>
        </div>

        <Editor id={id} />
      </section>

      <div className='flex flex-col items-center gap-2 basis-5/12 pt-8'>
        <Sortable />

        <section className='w-full'>
          <div className='flex items-center mt-5 mb-3'>
            <h2 className='font-bold text-4xl'>Output Paper & Key</h2>
          </div>
          <div className='px-4 pb-3 rounded-medium border border-default-500/20'>
            <Paper data={data} />
            <Key data={data} />
          </div>
        </section>

        <JsonEditor />
      </div>
    </div>
  )
}
