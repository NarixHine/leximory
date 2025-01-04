import { ClerkLoaded, OrganizationList, OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import { Metadata } from 'next'
import CopyToken, { CopyProfileLink } from './copy'
import { Button } from '@nextui-org/button'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { PiFastForwardDuotone, PiShareDuotone } from 'react-icons/pi'

export const metadata: Metadata = { title: '设置' }

export default async function Settings() {
    const { userId } = await auth()
    return <div className='flex flex-col gap-10'>
        <div className='flex justify-center gap-5'>
            <UserButton userProfileUrl='/settings/user' />
            <OrganizationSwitcher afterSelectPersonalUrl={'/library'} afterSelectOrganizationUrl={'/library'} createOrganizationUrl='/create' organizationProfileUrl='/settings/org' />
            <ClerkLoaded>
                <CopyToken />
            </ClerkLoaded>
        </div>
        <OrganizationList afterSelectPersonalUrl={'/library'} afterSelectOrganizationUrl={'/library'} />
        <ClerkLoaded>
            <div className='flex gap-3'>
                <Button color='primary' className='flex-1' variant='flat' as={Link} href={`/profile/${userId}`} endContent={<PiFastForwardDuotone />} >
                    My Profile
                </Button>
                <CopyProfileLink />
            </div>
        </ClerkLoaded>
    </div>
}
