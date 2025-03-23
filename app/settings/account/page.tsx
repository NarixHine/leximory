import { OrganizationList, OrganizationSwitcher } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'
import { Metadata } from 'next'
import Center from '@/components/ui/center'

export const metadata: Metadata = {
    title: '账号管理',
}

export default function AccountPage() {
    return <Center>
        <div className='flex flex-col gap-6'>
            <OrganizationList afterSelectPersonalUrl={'/library'} afterSelectOrganizationUrl={'/library'} />
            <div className='flex justify-center gap-5'>
                <UserButton userProfileUrl='/settings/user' />
                <OrganizationSwitcher afterSelectPersonalUrl={'/library'} afterSelectOrganizationUrl={'/library'} organizationProfileUrl='/settings/org' />
            </div>
        </div>
    </Center>
}
