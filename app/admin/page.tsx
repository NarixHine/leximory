import { Suspense } from 'react'
import AdminOverview from './components/overview'
import UsersList from './components/user-list'
import RegenerateTimesButton from './components/regenerate-times'
import { Card, CardBody, CardHeader } from '@heroui/card'
import { Spinner } from '@heroui/spinner'
import { getUsersOverview, getAllUsers } from './data-fetching'

export default async function AdminPage() {
    const [overview, users] = await Promise.all([
        getUsersOverview(),
        getAllUsers()
    ])

    return (
        <div className='flex flex-col gap-6'>
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
                            <RegenerateTimesButton />
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