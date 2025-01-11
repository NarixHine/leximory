import { ClerkLoaded, OrganizationList, OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import { Metadata } from 'next'
import CopyToken, { CopyProfileLink } from './components/copy'
import { Button } from '@nextui-org/button'
import Link from 'next/link'
import { PiFastForwardDuotone } from 'react-icons/pi'
import Preference from './components/preference'
import { getAuthOrThrow } from '@/lib/auth'
import { HydrationBoundary } from 'jotai-ssr'
import { accentAtom } from './atoms'
import { getPreference } from './actions'

export const metadata: Metadata = { title: '设置' }

export default async function Settings() {
    const { userId } = await getAuthOrThrow()
    const accent = await getPreference()
    return <HydrationBoundary hydrateAtoms={[
        [accentAtom, accent]
    ]}>
        <div className='flex flex-col gap-10'>
            <div className='flex justify-center gap-5'>
                <UserButton userProfileUrl='/settings/user' />
                <OrganizationSwitcher afterSelectPersonalUrl={'/library'} afterSelectOrganizationUrl={'/library'} createOrganizationUrl='/create' organizationProfileUrl='/settings/org' />
                <ClerkLoaded>
                    <CopyToken />
                </ClerkLoaded>
            </div>
            <OrganizationList afterSelectPersonalUrl={'/library'} afterSelectOrganizationUrl={'/library'} />
            <ClerkLoaded>
                <div className='flex items-center gap-3'>
                    <Preference />
                    <Button color='primary' className='flex-1' variant='flat' as={Link} href={`/profile/${userId}`} endContent={<PiFastForwardDuotone />} >
                        My Profile
                    </Button>
                    <CopyProfileLink />
                </div>
            </ClerkLoaded>
        </div>
    </HydrationBoundary>
}
