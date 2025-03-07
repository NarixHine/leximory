import { Metadata } from 'next'
import { OrganizationProfile } from '@clerk/nextjs'
import Center from '@/components/ui/center'
export const metadata: Metadata = { title: '小组资料' }

export default function Page() {
    return <Center>
        <OrganizationProfile path='/settings/org' />
    </Center>
}
