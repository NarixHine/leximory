import { getUserOrThrow } from '@repo/user'
import { PiPaperPlane } from 'react-icons/pi'
import { ADMIN_UID } from '@/lib/config'
import LinkButton from '@/components/ui/link-button'

export default async function AdminDashboardLink() {
    const { userId } = await getUserOrThrow()
    return userId === ADMIN_UID && (
        <LinkButton startContent={<PiPaperPlane />} href='/admin' variant='light'>
            管理界面
        </LinkButton>
    )
}
