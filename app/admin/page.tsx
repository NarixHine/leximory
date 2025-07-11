import { Suspense } from 'react'
import AdminOverview from './components/overview'
import UsersList from './components/user-list'
import RegenerateTimesButton from './components/regenerate-times'
import RegenerateTimesQuizButton from './components/regenerate-times-quiz'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Spinner } from '@heroui/spinner'
import { Button } from '@heroui/button'
import { getUsersOverview, getAllUsers } from './data-fetching'
import Link from 'next/link'
import { PiNewspaperDuotone } from 'react-icons/pi'

export default async function AdminPage() {
    const [overview, users] = await Promise.all([
        getUsersOverview(),
        getAllUsers()
    ])

    return (
        <div className='flex flex-col gap-6'>
            <header>
                <h2 className={'text-4xl font-medium text-center'}>Admin Panel</h2>
            </header>
            {/* Top Grid Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* System Overview - Takes 2 columns */}
                <div>
                    <AdminOverview overview={overview} />
                </div>

                {/* Quick Actions Card */}
                <div>
                    <Card className='h-full p-4' shadow='sm'>
                        <CardHeader className='pb-3'>
                            <h3 className='text-lg'>Quick Actions</h3>
                        </CardHeader>
                        <CardBody className='pt-0'>
                            <div className='space-y-2'>
                                <RegenerateTimesButton />
                                <RegenerateTimesQuizButton />
                                <Button
                                    as={Link}
                                    href='/admin/times'
                                    variant='flat'
                                    startContent={<PiNewspaperDuotone />}
                                    fullWidth
                                    color='secondary'
                                >
                                    Manage Times Issues
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>

            <Suspense fallback={
                <div className='flex justify-center items-center p-12'>
                    <Spinner size='lg' />
                </div>
            }>
                <UsersList users={users} />
            </Suspense>
        </div>
    )
}
