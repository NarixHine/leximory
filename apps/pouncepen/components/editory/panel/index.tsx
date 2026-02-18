'use client'

import { SealQuestionIcon, OptionIcon, MagicWandIcon, CloudCheckIcon } from '@phosphor-icons/react'
import { Paper } from '@repo/ui/paper'
import Sortable from './sortable'
import Editor from './editor'
import { JsonEditor } from './json-editor'
import { ImportButton } from './import'
import { useAtomValue } from 'jotai'
import { ReviseAllButton } from './editor/revise-paper/revise-all-button'
import { Copyright } from './copyright'
import { EditModeSwitch } from './edit-mode-switch'
import { PouncePenIcon } from '@/components/ui/logo'
import { useUpdateEffect } from 'ahooks'
import { useDebounceCallback } from 'usehooks-ts'
import { updatePaperAction, getPaperVersionAction } from '@repo/service/paper'
import { useAction } from '@repo/service'
import { AnimatePresence, motion } from 'framer-motion'
import { Spinner } from '@heroui/react'
import { editoryItemsAtom } from '@repo/ui/paper/atoms'
import { useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'


export default function Editory({ id }: { id?: string }) {
  const data = useAtomValue(editoryItemsAtom)

  // --- Sync hardening: optimistic concurrency control ---
  // The server-side version this client's state is based on.
  // Loaded on mount, advanced on each successful save.
  const baseVersionRef = useRef<number | null>(null)
  // Always hold the latest data in a ref so callbacks never read stale closures.
  const latestDataRef = useRef(data)
  latestDataRef.current = data
  // Guards against concurrent in-flight saves within the same tab.
  const syncInFlightRef = useRef(false)
  // Tracks whether data changed while a save was in-flight.
  const pendingRetryRef = useRef(false)
  // Ref to executeSync for use in callbacks without circular deps.
  const executeSyncRef = useRef<() => void>(() => {})

  const { execute: sync, isPending } = useAction(updatePaperAction, {
    onSuccess: ({ data: result }) => {
      syncInFlightRef.current = false
      // Advance baseVersion so the next save uses the new version.
      if (result?.version !== undefined) {
        baseVersionRef.current = result.version
      }
      // If data changed while this save was in-flight, trigger another sync.
      if (pendingRetryRef.current) {
        pendingRetryRef.current = false
        executeSyncRef.current()
      }
    },
    onError: ({ error }) => {
      syncInFlightRef.current = false
      if (error.serverError === 'VERSION_CONFLICT') {
        // Another window/tab already saved a newer version.
        toast.error('此试卷已在其他窗口中被修改，即将刷新以加载最新版本。')
        setTimeout(() => window.location.reload(), 1500)
      }
    },
  })
  const { execute: fetchVersion } = useAction(getPaperVersionAction, {
    onSuccess: ({ data: result }) => {
      if (result) {
        baseVersionRef.current = result.version
      }
    },
    onError: () => {
      // If version fetch fails, fall back to saving without OCC
      // rather than silently blocking all saves.
      baseVersionRef.current = -1
    },
  })

  // Seed baseVersion from Redis when the editor page opens.
  useEffect(() => {
    if (!id) return
    fetchVersion({ id: parseInt(id) })
  }, [id, fetchVersion])

  const executeSync = useCallback(() => {
    if (!id || baseVersionRef.current === null) return
    // If a previous save is still in-flight, mark for retry after it completes.
    if (syncInFlightRef.current) {
      pendingRetryRef.current = true
      return
    }
    syncInFlightRef.current = true

    sync({
      id: parseInt(id),
      data: { content: latestDataRef.current },
      // Pass baseVersion only if it was successfully fetched (>= 0).
      // A value of -1 means the initial fetch failed; save without OCC.
      ...(baseVersionRef.current >= 0 ? { baseVersion: baseVersionRef.current } : {}),
    })
  }, [id, sync])
  executeSyncRef.current = executeSync

  const debouncedSync = useDebounceCallback(executeSync, 1000)

  useUpdateEffect(() => {
    debouncedSync()
  }, [data])

  return (
    <div className='gap-4 flex-col lg:flex-row flex'>
      <section className='flex flex-col sm:flex-row sm:basis-7/12 shrink-0'>
        <div className='p-4 flex flex-col space-y-3 items-end'>
          <div className='flex flex-row items-center justify-between sm:items-end sm:justify-normal sm:flex-col w-full gap-2 sm:w-min min-w-50'>
            <h2 className='font-bold text-6xl text-secondary-300 sm:mt-8 items-center flex'>
              {
                id
                  ? (
                    <AnimatePresence mode='wait'>
                      {isPending ? (
                        <motion.span
                          key='loading'
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className='inline-block mr-3 mb-2.5 self-baseline-last'
                        >
                          <Spinner variant='simple' className='block' color='secondary' size='sm' />
                        </motion.span>
                      ) : (
                        <motion.span
                          key='saved'
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className='inline-block mr-2 mb-2 self-baseline-last'
                        >
                          <CloudCheckIcon className='size-7' />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  )
                  : <PouncePenIcon className='size-15 hidden sm:block dark:opacity-80' />
              } Pen
            </h2>

            <div className='flex flex-col gap-2 text-sm text-secondary-400/70 w-26 sm:w-36 self-end shrink sm:shrink-0'>
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
                <span className='font-bold sm:tracking-widest'>选中<span className='hidden sm:inline'>词句</span></span>唤起<span className='hidden sm:inline'>悬浮</span>菜单
              </p>
            </div>
          </div>

          <div className='flex justify-end lg:pl-4 gap-2 flex-col sm:flex-wrap sm:justify-end w-full'>
            <ImportButton />
            <ReviseAllButton />
            <EditModeSwitch />
          </div>

          <div className='hidden sm:flex justify-end mt-auto'>
            <Copyright />
          </div>
        </div>

        <div className='flex-1'>
          <Editor id={id} />
        </div>
      </section>

      <div className='flex flex-col items-center gap-2 basis-5/12 pt-8'>
        <Sortable />

        <section className='w-full'>
          <div className='flex items-center mt-5 mb-3'>
            <h2 className='font-bold text-4xl'>Paper & Key</h2>
          </div>
          <div className='px-4 pb-3 rounded-medium border border-default-500/20'>
            <Paper data={data} />
          </div>
        </section>

        <JsonEditor />
      </div>
    </div>
  )
}
