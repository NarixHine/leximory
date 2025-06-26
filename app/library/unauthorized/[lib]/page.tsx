'use client'

import { useAtomValue } from 'jotai'
import { libAtom, priceAtom } from '../../[lib]/atoms'
import Center from '@/components/ui/center'
import Link from 'next/link'
import { contentFontFamily } from '@/lib/fonts'
import BuyLibrary from '@/components/buy-library'

export default function UnauthorizedPage() {
    const price = useAtomValue(priceAtom)
    const lib = useAtomValue(libAtom)

    return (
        <Center>
            <div className='prose dark:prose-invert prose-lg max-w-xl' style={{ fontFamily: contentFontFamily }}>
                <h1>获取文库</h1>
                <p>你正在尝试访问的内容来自共享文库，需要<b>通过 LexiCoin 购买</b>后才能完整访问。LexiCoin 可在<Link href={'/settings'} className='underline-offset-4'>设置页面</Link>每日领取。</p>
                <p>购买后，这个文库将被<b>添加到你的主页</b>。你将可以通过<b> UI 界面和 Talk to Your Library 智能对话访问</b>文库中的所有文章，语料库中新增的语汇也会出现在你的每日整理当中。</p>
                <p>已购买的共享文库可随时归档和取消收藏。</p>

                <BuyLibrary
                    isStarred={false}
                    id={lib}
                    price={price}
                    navigateAfterPurchase={true}
                />
            </div>
        </Center>
    )
}
