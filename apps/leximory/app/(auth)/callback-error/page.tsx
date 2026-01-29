import { Card, CardBody, CardHeader } from '@heroui/card'
import { PiWarningCircle, PiArrowLeft } from 'react-icons/pi'
import Link from 'next/link'

export default function CallbackErrorPage() {
    return <Card className='w-full max-w-md p-5' shadow='sm'>
        <CardHeader className='flex flex-col items-center gap-4 pb-2'>
            <div className='p-3 rounded-full bg-red-100 dark:bg-red-900/20'>
                <PiWarningCircle className='w-8 h-8 text-red-600 dark:text-red-400' />
            </div>
            <h1 className='text-2xl font-bold text-red-600 dark:text-red-400'>
                Authentication Error
            </h1>
        </CardHeader>
        <CardBody className='text-center space-y-6'>
            <div className='space-y-2'>
                <p className='text-gray-600 dark:text-gray-400'>
                    We encountered an issue while signing you in.
                </p>
            </div>

            <div className='space-y-3'>
                <Link
                    href='/login'
                    className='w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors'
                >
                    Try Again
                </Link>

                <Link
                    href='/'
                    className='w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                >
                    <PiArrowLeft className='w-4 h-4' />
                    Back to Home
                </Link>
            </div>
        </CardBody>
    </Card>
}
