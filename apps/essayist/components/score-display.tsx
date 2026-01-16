'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@heroui/button'
import { Spinner } from '@heroui/spinner'
import { PiSignOut } from 'react-icons/pi'

interface ScoreDisplayProps {
  scores: (number | undefined)[]
  isPending: boolean
  onTryAnother: () => void
}

export default function ScoreDisplay({ scores, isPending, onTryAnother }: ScoreDisplayProps) {
  const total = scores.length > 0 && scores.every(score => typeof score === 'number') ? scores.reduce((a, b) => (a || 0) + (b || 0), 0) : undefined

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.3 } }}
      className='text-2xl flex items-center gap-1 mb-2'
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={`score-0-${scores[0] || 'X'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
        >
          {scores.length > 0 ? scores[0] : 'X'}
        </motion.span>
      </AnimatePresence>
      <span>+</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={`score-1-${scores[1] || 'X'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
        >
          {scores.length > 1 ? scores[1] : 'X'}
        </motion.span>
      </AnimatePresence>
      <span>+</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={`score-2-${scores[2] || 'X'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
        >
          {scores.length > 2 ? scores[2] : 'X'}
        </motion.span>
      </AnimatePresence>
      <span>=</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={`total-${total || 'X'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
        >
          {total !== undefined ? total : 'X'}
        </motion.span>
      </AnimatePresence>
      {isPending ? <Spinner variant='dots' className='ml-2' /> : <Button isIconOnly size='sm' startContent={<PiSignOut size={20} />} onPress={onTryAnother} variant='light' className='ml-2' />}
    </motion.div>
  )
}