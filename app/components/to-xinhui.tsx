'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { CHINESE_CALLIGRAPHY } from '@/lib/fonts'
import { Card, CardBody } from "@heroui/card"
import { useRouter } from 'next/navigation'

export function ToXinhui() {
    const router = useRouter()
    return <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
    >
        <Card className='mx-auto' isPressable isBlurred shadow='none' onPress={() => {
            router.push('/sign-in')
        }}>
            <CardBody className={cn(CHINESE_CALLIGRAPHY.className, 'whitespace-pre-line text-6xl text-center')}>
                {'从记忆\n到心会'}
            </CardBody>
        </Card>
    </motion.div>
}
