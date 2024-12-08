import Main from '@/components/main'
import { OrganizationList, OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import { Metadata } from 'next'
import { PiKeyDuotone } from 'react-icons/pi'
import { toast } from 'sonner'
import getToken from './actions'
import { Button } from '@nextui-org/button'
import CopyToken from './copy-token'

export const metadata: Metadata = { title: '设置' }

export default function Settings() {
    return <div className='flex flex-col gap-10'>
        <div className='flex justify-center gap-5'>
            <UserButton userProfileUrl='/settings/user' />
            <OrganizationSwitcher afterSelectPersonalUrl={'/library'} afterSelectOrganizationUrl={'/library'} createOrganizationUrl='/create' organizationProfileUrl='/settings/org' />
            <CopyToken />
        </div>
        <OrganizationList afterSelectPersonalUrl={'/library'} afterSelectOrganizationUrl={'/library'} />
    </div>
}
