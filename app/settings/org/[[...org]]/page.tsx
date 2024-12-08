import { Metadata } from 'next'
import { OrganizationProfile } from '@clerk/nextjs'

export const metadata: Metadata = { title: '小组资料' }

export default function Page() {
    return <OrganizationProfile path='/settings/org' />
}
