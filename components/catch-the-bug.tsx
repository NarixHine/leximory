'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { motion } from 'framer-motion'
import { PiBugDroidDuotone } from 'react-icons/pi'
import { Button } from '@nextui-org/button'

export const CatchTheBug: React.FC = () => {
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [score, setScore] = useState(0)
    const [isFreezing, startFreeze] = useTransition()

    useEffect(() => {
        const moveInterval = setInterval(() => {
            setPosition({
                x: Math.random() * 200 - 100,
                y: Math.random() * 200 - 100,
            })
        }, 2000)

        return () => clearInterval(moveInterval)
    }, [])

    const handleCatch = () => {
        setScore(score + 1)
        startFreeze(() => new Promise(resolve => setTimeout(resolve, 1000)))
    }

    return (
        <div className='relative w-full h-64 bg-[#E8EEE7] overflow-hidden'>
            <div className='absolute inset-0 flex items-center justify-center'>
                <p className='text-2xl font-bold text-gray-700'>{score}</p>
            </div>
            <motion.div
                className='absolute z-10'
                animate={position}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{ x: position.x, y: position.y }}
            >
                <Button
                    isIconOnly
                    onPress={handleCatch}
                    isDisabled={isFreezing}
                    color='primary'
                    startContent={<PiBugDroidDuotone className='text-2xl' />}
                    className='w-8 h-8 bg-[#B8C5B6] rounded-full flex items-center justify-center focus:outline-none'
                >
                </Button>
            </motion.div>
        </div>
    )
}
