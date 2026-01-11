import { Card, CardBody } from '@heroui/card'
import { PiCrownDuotone } from 'react-icons/pi'
import LinkButton from '@repo/ui/link-button'
import { getPlan } from '@repo/user'

export default async function UpgradeMessage() {
    const plan = await getPlan()
    if (plan === 'beginner')
        return (
            <Card className='mb-8 bg-linear-to-r from-primary-50/20 to-secondary-50/20' shadow='none' isBlurred>
                <CardBody className='p-6'>
                    <div className='flex items-start gap-4'>
                        <div className='p-2 rounded-full bg-primary-100/50'>
                            <PiCrownDuotone className='text-primary' size={24} />
                        </div>
                        <div className='flex-1'>
                            <h3 className='text-lg font-medium mb-1'>升级</h3>
                            <p className='text-sm text-default-500 mb-4'>
                                Talk to Your Library 是高级版的专属功能。
                            </p>
                            <LinkButton
                                href='/settings'
                                color='primary'
                                variant='flat'
                            >
                                立即升级
                            </LinkButton>
                        </div>
                    </div>
                </CardBody>
            </Card>
        )
    else
        return null
} 