'use client'

import { OrganizationSwitcher, UserButton, useUser } from '@clerk/nextjs'
import {
	NavbarBrand,
	NavbarContent,
	Navbar as NextUINavbar,
	Button
} from '@nextui-org/react'
import { PiSignInDuotone } from 'react-icons/pi'
import Link from 'next/link'
import Image from 'next/image'
import Logo from './logo.png'
import { english_heading, chinese_kaishu } from '@/lib/fonts'
import { useRouter } from 'next/navigation'
import { useAtomValue } from 'jotai'
import { isReaderModeAtom } from '@/app/atoms'
import { cn } from '@/lib/utils'

function Navbar({ userId: defaultUserId }: {
	userId: string | null | undefined
}) {
	const user = useUser()
	const userId = user.isLoaded ? user.user?.id : defaultUserId
	const router = useRouter()
	const isReaderMode = useAtomValue(isReaderModeAtom)

	return !isReaderMode && <div className='px-10 pt-3 sticky top-0 z-50'>
		<NextUINavbar className='rounded-full border-1 border-primary-300/50 dark:border-danger-100/50 h-14'>
			<NavbarBrand className='space-x-2'>
				<Image src={Logo} alt='Leximory' width={24} height={24} quality={100} onClick={() => {
					router.push(userId ? '/library' : '/')
				}}></Image>
			</NavbarBrand>
			{userId && <NavbarBrand className={cn(english_heading.className, 'text-2xl text-danger mx-1 justify-center hidden sm:flex')}>
				<Link href={'/library'}>Leximory</Link>
			</NavbarBrand>}
			<NavbarContent as={'div'} justify='end'>
				{
					userId ?
						<>
							<OrganizationSwitcher afterSelectPersonalUrl={'/library'} afterSelectOrganizationUrl={'/library'} createOrganizationUrl='/create' organizationProfileUrl='/org'></OrganizationSwitcher>
							<UserButton userProfileUrl='/user'></UserButton>
						</> :
						<Button as={Link} variant='flat' color='danger' href='/sign-in' radius='full' className={chinese_kaishu.className} startContent={<PiSignInDuotone />}>开始学习</Button>
				}
			</NavbarContent>
		</NextUINavbar>
	</div>
}

export default Navbar
