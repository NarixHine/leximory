'use client'

import { useAtomValue } from 'jotai'
import { useRouter } from 'next/navigation'
import { totalPagesAtom } from '../atoms'
import { Pagination as HeroUIPagination } from '@heroui/pagination'

export default function Pagination({ page }: { page: number }) {
    const totalPages = useAtomValue(totalPagesAtom)
    const router = useRouter()

    const handlePageChange = (newPage: number) => {
        router.push(`/marketplace/${newPage}`)
    }

    return (
        <div className='flex justify-center mt-auto'>
            <HeroUIPagination
                color='secondary'
                variant='flat'
                total={totalPages}
                page={page}
                onChange={handlePageChange}
            />
        </div>
    )
}
