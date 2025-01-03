import { ClerkLoaded, OrganizationList, OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import { Metadata } from 'next'
import CopyToken from './copy-token'

export const metadata: Metadata = { title: '设置' }

export default function Settings() {
    return <div className='flex flex-col gap-10'>
        <div className='flex justify-center gap-5'>
            <UserButton userProfileUrl='/settings/user' />
            <OrganizationSwitcher afterSelectPersonalUrl={'/library'} afterSelectOrganizationUrl={'/library'} createOrganizationUrl='/create' organizationProfileUrl='/settings/org' />
            <ClerkLoaded>
                <CopyToken />
            </ClerkLoaded>
        </div>
        <OrganizationList afterSelectPersonalUrl={'/library'} afterSelectOrganizationUrl={'/library'} />
    </div>
}
