'use client'

import { useQuery } from '@tanstack/react-query'
import { Spinner } from '@heroui/spinner'
import { ReactNode } from 'react'

async function checkAdminAccess() {
    const response = await fetch('/api/admin/check', {
        method: 'GET',
        credentials: 'include'
    })
    
    if (!response.ok) {
        throw new Error('Not authorized')
    }
    
    return response.json()
}

export default function AdminGuard({ children }: { children: ReactNode }) {
    const { isLoading, error } = useQuery({
        queryKey: ['admin-check'],
        queryFn: checkAdminAccess,
        retry: false,
    })

    if (isLoading) {
        return (
            <div className='flex justify-center items-center min-h-screen'>
                <Spinner size='lg' />
            </div>
        )
    }

    if (error) {
        return (
            <div className='flex justify-center items-center min-h-screen'>
                <p className='text-danger text-lg'>Unauthorized access to admin area</p>
            </div>
        )
    }

    return <>{children}</>
}
