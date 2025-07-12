'use client'

import { cn } from '@/lib/utils'
import { Chip } from "@heroui/chip"

export default function Topics({ topics, remove, className }: { topics: string[] | null | undefined, remove?: (topic: string) => void, className?: string }) {
  return topics && topics.length > 0 && <div className={cn('flex gap-2 flex-wrap', className)}>
    {
      topics.map(topic => <Chip
        key={topic}
        size='sm'
        variant={'light'}
        classNames={{
          base: cn('border-none underline decoration-1 underline-offset-4 decoration-default-700 text-default-700'),
          content: 'px-0'
        }}
        onClose={remove && (() => {
          remove(topic)
        })}>{topic}</Chip>)
    }
  </div>
}
