import { getUserOrThrow } from '@repo/user'
import { getSubsStatus } from '@/server/db/subs'
import BellButton from '../../review/components/bell'

export default async function Bell() {
    const { userId } = await getUserOrThrow()
    const { hasSubs, hour } = await getSubsStatus({ userId })
    return <BellButton hasSubs={hasSubs} hour={hour} />
}
