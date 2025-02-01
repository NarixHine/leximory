'use client'

import { useAtomValue } from 'jotai'
import { totalPagesAtom } from '../atoms'
import { Pagination as HeroUIPagination } from "@heroui/pagination"

export const PAGE_SIZE = 6

export default function Pagination({page }: { page: number }) {
    const totalPages = useAtomValue(totalPagesAtom)
    return <div className='flex justify-center'>
        <HeroUIPagination variant='bordered' color='primary' total={totalPages} page={page} />
    </div>
}