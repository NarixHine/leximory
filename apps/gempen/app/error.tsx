'use client'

import Hero from '@/components/ui/hero'
import { Button } from '@heroui/button'
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { clearCookies } from './actions'
import { toast } from 'sonner'

export default function Error({
    error,
    reset
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <Hero title='ERROR' description={error.digest && `故障 ID： ${error.digest}`}>
            <div className='flex gap-2'>
                <Button
                    endContent={<ArrowCounterClockwiseIcon weight='fill' size={20} />}
                    color='primary'
                    size='sm'
                    onPress={() => reset()}
                >
                    重试
                </Button>
                <Button
                    size='sm'
                    as={Link}
                    href='/'
                >
                    返回主页
                </Button>
                <Button
                    size='sm'
                    onPress={async () => {
                        localStorage.clear()
                        toast.promise(clearCookies(), {
                            loading: '正在清除缓存',
                            success: '缓存已清除',
                            error: '清除缓存失败',
                        })
                    }}
                >
                    清除缓存
                </Button>
            </div>
        </Hero>
    )
}
