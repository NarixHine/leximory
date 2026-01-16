'use client'

import { Key, Paper } from '@/components/editory'
import { editoryItemsAtom } from '@/components/editory/atoms'
import Main from '@/components/ui/main'
import { Button } from '@heroui/button'
import { PrinterIcon, SkipBackIcon } from '@phosphor-icons/react'
import { useAtomValue } from 'jotai'
import { useRouter } from 'next/navigation'

export default function Page() {
    const data = useAtomValue(editoryItemsAtom)
    const router = useRouter()
    return <Main>
        <div className='flex gap-3'>
            <Button
                startContent={<SkipBackIcon />}
                size='lg'
                className='print:none'
                onPress={() => { router.back() }}
                isIconOnly
            ></Button>
            <Button
                startContent={<PrinterIcon />}
                size='lg'
                className='print:none flex-1'
                color='primary'
                onPress={() => { print() }}
            >打印</Button>
        </div>
        <Paper data={data} />
        <Key data={data} accordionClassName='print:hidden' />
    </Main>
}
