'use client'

import { Popover, PopoverTrigger, PopoverContent } from '@heroui/popover'
import { Spinner } from '@heroui/react'
import { Streamdown } from 'streamdown'

interface HighlightedTextProps {
  text: string
  type: 'bad' | 'good'
  details: string
}

export default function HighlightedText({ text, type, details }: HighlightedTextProps) {
  const underlineClass = type === 'bad' ? 'decoration-red-400' : 'decoration-green-400'
  return (
    <Popover shadow='sm'>
      <PopoverTrigger>
        <span className={`cursor-pointer underline underline-offset-4 ${underlineClass}`}>
          {text}
        </span>
      </PopoverTrigger>
      <PopoverContent>
        <div className='p-3 max-w-sm'>
          <div className='text-small italic text-default-500 mb-1'>
            {type === 'bad' ? 'Improved.' : 'Good.'}
          </div>
          {details && details !== '' ? <Streamdown className='text-medium'>{details}</Streamdown> : <Spinner variant='dots' />}
        </div>
      </PopoverContent>
    </Popover>
  )
}