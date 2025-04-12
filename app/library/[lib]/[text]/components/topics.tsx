'use client'

import { cn } from '@/lib/utils'
import { Chip } from "@heroui/chip"
import { useAtomValue } from 'jotai'
import { isReaderModeAtom } from '@/app/atoms'
import { CHINESE_ZCOOL } from '@/lib/fonts'

export default function Topics({ topics, remove }: { topics: string[] | null | undefined, remove?: (topic: string) => void }) {
  const isReaderMode = useAtomValue(isReaderModeAtom)
  return topics && topics.length > 0 && <div className={cn('flex gap-2 mt-1 justify-center items-center', isReaderMode && '-mb-1')}>
    {
      topics.map(topic => <Chip key={topic} size='sm' variant={'light'} className={cn('border-none underline decoration-1 underline-offset-4 decoration-default-700 text-default-700', CHINESE_ZCOOL.className)} onClose={remove && (() => {
        remove(topic)
      })}>{topic}</Chip>)
    }
  </div>
}
