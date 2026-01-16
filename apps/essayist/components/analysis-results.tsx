'use client'

import { Streamdown } from 'streamdown'

interface AnalysisResultsProps {
  correctedText: string
}

export default function AnalysisResults({ correctedText }: AnalysisResultsProps) {
  return (
    <div className='flex-1 pt-4 md:pt-0 md:pl-4'>
      <h2 className='text-xl font-semibold'>The Verdict</h2>
      <div className='mb-4 prose dark:prose-invert'>
        <Streamdown>{correctedText}</Streamdown>
      </div>
    </div>
  )
}