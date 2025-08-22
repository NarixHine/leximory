import Center from '@/components/ui/center'
import Link from 'next/link'
import BuyLibrary from '@/components/buy-library'
import { LibProps } from '@/lib/types'
import { authReadToLibWithoutThrowing } from '@/server/auth/role'
import { getLib } from '@/server/db/lib'
import { redirect } from 'next/navigation'
import UserAvatar from '@/components/avatar'
import { LIB_ACCESS_STATUS } from '@/lib/config'

export async function generateMetadata(props: LibProps) {
    const params = await props.params
    const { name } = await getLib({ id: params.lib })
    return {
        title: {
            default: `获取文库 | ${name} | Leximory`,
            template: `获取文库 | ${name} | Leximory`
        }
    }
}

export default async function UnauthorizedPage(
    props: {
        params: Promise<{ lib: string }>
    }
) {
    const params = await props.params

    const { isOwner, isStarred, price, owner, access } = await authReadToLibWithoutThrowing(params.lib)

    if (access !== LIB_ACCESS_STATUS.public && !isOwner) {
        throw new Error('Access denied to this library')
    }
    else if (isOwner || isStarred) {
        redirect(`/library/${params.lib}`)
    }

    return (
        <Center>
            <div className='prose dark:prose-invert prose-lg max-w-xl font-formal'>
                <h1>获取文库</h1>
                <p>你正在尝试访问的内容来自共享文库，需要<b>通过 LexiCoin 购买</b>后才能完整访问。LexiCoin 可在<Link href={'/settings'} className='underline-offset-4'>设置页面</Link>每日免费领取。</p>
                <p>购买后，这个文库将被<b>添加到你的主页</b>。你将可以通过<b> UI 界面和 Talk to Your Library 智能对话访问</b>文库中的所有文章，语料库中新增的语汇也会出现在你的每日整理当中。</p>
                <p>已购买的共享文库可随时归档和取消收藏。</p>

                <BuyLibrary
                    isStarred={false}
                    id={params.lib}
                    price={price}
                    navigateAfterPurchase={true}
                    avatar={<UserAvatar uid={owner} />}
                />
            </div>
        </Center>
    )
}
