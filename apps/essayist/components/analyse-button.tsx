'use client'

import { Button } from '@heroui/button'
import { ProtectedButton } from '@repo/ui/protected-button'
import { motion } from 'framer-motion'
import { PiMarkerCircle } from 'react-icons/pi'

interface AnalyseButtonProps {
  onPress: () => void
}

export default function AnalyseButton({ onPress }: AnalyseButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.3 } }}
    >
      <ProtectedButton onPress={onPress} variant='light' color='primary' startContent={<PiMarkerCircle />} className='text-2xl px-1'>
        Analyse
      </ProtectedButton>
    </motion.div>
  )
}