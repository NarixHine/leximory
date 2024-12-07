'use client'

import { cn, stringToColor } from '@/lib/utils'
import { Chip } from '@nextui-org/chip'
import { useAtomValue } from 'jotai'
import { isReaderModeAtom } from '@/app/atoms'

export default function Topics({ topics, remove }: { topics: string[] | null | undefined, remove?: (topic: string) => void }) {
  const isReaderMode = useAtomValue(isReaderModeAtom)
  return topics && topics.length > 0 && <div className={cn('flex gap-2 mt-1 justify-center items-center', isReaderMode && '-mb-1')}>
    {
      topics.map(topic => <Chip key={topic} size='sm' variant={isReaderMode ? 'dot' : 'flat'} className='border-none' onClose={remove && (() => {
        remove(topic)
      })} color={isReaderMode ? 'default' : stringToColor(topic)}>{topic}</Chip>)
    }
  </div>
}
