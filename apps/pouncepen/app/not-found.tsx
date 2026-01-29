'use client'

import Hero from '@/components/ui/hero'
import { Button } from '@heroui/button'
import { HouseLineIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'

export default function NotFound() {
    return (
        <Hero title='404' description='页面未找到'>
            <Button
                endContent={<HouseLineIcon weight='fill' size={20} />}
                color='primary'
                size='sm'
                as={Link}
                href='/'
            >
                返回主页
            </Button>
        </Hero>
    )
}
