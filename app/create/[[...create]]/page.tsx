import { Metadata } from 'next'
import Center from '@/components/center'
import { CreateOrganization } from '@clerk/nextjs'

export const metadata: Metadata = { title: '创建小组' }

export default function Page() {
    return <Center>
        <CreateOrganization path='/create' />
    </Center>
}
