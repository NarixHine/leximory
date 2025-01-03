'use client'

import { useAtomValue } from 'jotai'
import { totalPagesAtom } from '../atoms'
import { Pagination as NextUIPagination } from '@nextui-org/pagination'

export default function Pagination({page }: { page: number }) {
    const totalPages = useAtomValue(totalPagesAtom)
    return <div className='flex justify-center'>
        <NextUIPagination variant='bordered' color='primary' total={totalPages} page={page} />
    </div>
}