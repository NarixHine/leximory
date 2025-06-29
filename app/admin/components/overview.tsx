import { Card, CardBody, CardHeader } from '@heroui/card'
import { Chip } from '@heroui/chip'
import { Divider } from '@heroui/divider'

interface AdminOverviewProps {
    overview: {
        totalUsers: number
        activeUsers: number
        usersByPlan: Record<string, number>
    }
}

export default function AdminOverview({ overview }: AdminOverviewProps) {
    const { totalUsers, activeUsers, usersByPlan } = overview

    return (
        <Card className='w-full h-full p-4' shadow='sm'>
            <CardHeader className='pb-4'>
                <h2 className='text-xl font-medium'>System Overview</h2>
            </CardHeader>
            <CardBody className='space-y-6'>
                {/* Main Stats Grid */}
                <div className='grid grid-cols-2 gap-8'>
                    <div className='text-center space-y-2'>
                        <div className='text-4xl font-extrabold text-primary'>{totalUsers}</div>
                        <div className='text-small opacity-60 font-medium'>Total Users</div>
                    </div>
                    <div className='text-center space-y-2'>
                        <div className='text-4xl font-extrabold text-secondary'>{activeUsers}</div>
                        <div className='text-small opacity-60 font-medium'>Active Users (30d)</div>
                    </div>
                </div>

                <Divider className='my-4' />

                {/* Users by Plan Section */}
                <div className='space-y-4'>
                    <h3 className='text-lg font-medium'>Users by Plan</h3>
                    <div className='grid grid-cols-2 gap-3'>
                        {Object.entries(usersByPlan).map(([plan, count]) => (
                            <div key={plan} className='flex justify-between items-center p-3 rounded-lg border border-divider'>
                                <Chip 
                                    size='sm' 
                                    variant='flat'
                                    color={
                                        plan === 'leximory' ? 'secondary' :
                                        plan === 'polyglot' ? 'primary' :
                                        plan === 'bilingual' ? 'success' :
                                        'default'
                                    }
                                    className='capitalize'
                                >
                                    {plan}
                                </Chip>
                                <span className='text-lg'>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardBody>
        </Card>
    )
}
