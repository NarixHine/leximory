import { Button } from '@heroui/button'
import { motion } from 'framer-motion'
import Image from 'next/image'

export default function EssayistTitle() {
  return (
    <motion.h1
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.3 } }}
    >
      <Button variant='light' color='primary' isDisabled className='text-2xl px-1 opacity-100 italic'>
        Essayist
      </Button>
    </motion.h1>
  )
}