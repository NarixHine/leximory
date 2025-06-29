import { getUserOrThrow } from '@/server/auth/user'
import { Button } from '@heroui/button'
import { PiPaperPlane } from 'react-icons/pi'
import Link from 'next/link'
import { ADMIN_UID } from '@/lib/config'

export default async function AdminDashboardLink() {
    const { userId } = await getUserOrThrow()
    return userId === ADMIN_UID && (
        <Button as={Link} startContent={<PiPaperPlane />} href='/admin' variant='light'>
            管理界面
        </Button>
    )
}
