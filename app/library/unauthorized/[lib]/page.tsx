'use client'

import { Button } from "@heroui/button"
import { useAtomValue } from 'jotai'
import { libAtom, priceAtom } from '../../[lib]/atoms'
import { PiShoppingCartDuotone } from 'react-icons/pi'
import { useTransition } from 'react'
import { star } from '../../[lib]/components/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Center from '@/components/ui/center'
import Link from 'next/link'

export default function UnauthorizedPage() {
    const price = useAtomValue(priceAtom)
    const lib = useAtomValue(libAtom)
    const [isTransitioning, startTransition] = useTransition()
    const router = useRouter()

    return (
        <Center>
            <div className='prose prose-lg max-w-xl'>
                <h1>获取文库</h1>
                <p>你正在尝试访问的内容来自共享文库，需要<b>通过 LexiCoin 购买</b>后才能完整访问。LexiCoin 可在<Link href={'/settings'} className='underline-offset-4'>设置页面</Link>每日领取。</p>
                <p>购买后，这个文库将被<b>添加到你的主页</b>。你将可以通过<b> UI 界面和 Talk to Your Library 智能对话访问</b>文库中的所有文章，语料库中新增的语汇也会出现在你的每日整理当中。</p>
                <p>已购买的共享文库可随时归档和取消收藏。</p>

                <Button
                    color='primary'
                    isLoading={isTransitioning}
                    onPress={() => {
                        startTransition(async () => {
                            const { success, message } = await star(lib)
                            if (success) {
                                router.push(`/library/${lib}`)
                            }
                            else {
                                toast.error(message)
                            }
                        })
                    }}
                    startContent={!isTransitioning && <PiShoppingCartDuotone className='w-5 h-5' />}
                >
                    用 {price} LexiCoin 购买
                </Button>
            </div>
        </Center>
    )
}
