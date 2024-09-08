import { Metadata } from 'next'
import Center from '@/components/center'
import { OrganizationProfile } from '@clerk/nextjs'

export const metadata: Metadata = { title: '小组资料' }

export default function Page() {
    return <Center>
        <OrganizationProfile path='/org' />
    </Center>
}
