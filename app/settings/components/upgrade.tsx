'use client'

import { Button } from '@heroui/button'
import { PiRocketLaunchDuotone, PiQuestion } from 'react-icons/pi'
import { Drawer, DrawerBody, DrawerContent } from '@heroui/drawer'
import { useDisclosure } from '@heroui/modal'
import { manageSubscription } from '../actions'
import Link from 'next/link'
import { bilibiliLink } from '@/lib/config'
import Pricing from '@/components/pricing'

export default function Upgrade({ isOnFreeTier }: { isOnFreeTier: boolean }) {
    const { isOpen, onOpen, onClose } = useDisclosure()
    return <>
        <Button onPress={() => isOnFreeTier ? onOpen() : manageSubscription()} variant='solid' startContent={<PiRocketLaunchDuotone />} size='lg' color='primary' radius='full' className='font-semibold'>{isOnFreeTier ? '升级' : '管理订阅'}</Button>
        <Drawer isOpen={isOpen} onOpenChange={onOpen} onClose={onClose} placement='bottom'>
            <DrawerContent className='bg-background max-h-[90vh] sm:max-h-[80vh] md:max-h-[75vh] overflow-y-auto'>
                {() => (
                    <DrawerBody>
                        <Pricing />
                        <p className='text-default-600 text-sm text-center pb-4'>
                            <PiQuestion className='inline-block' />遇到问题？<Link href={bilibiliLink} className='underline underline-offset-4'>在 B 站上</Link>联系我们，或发邮件到 <Link href='mailto:hi@leximory.com' className='underline underline-offset-4'>hi@leximory.com</Link>
                        </p>
                    </DrawerBody>
                )}
            </DrawerContent>
        </Drawer>
    </>
}
