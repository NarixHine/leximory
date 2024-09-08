'use client'

import { OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import {
	NavbarBrand,
	NavbarContent,
	Navbar as NextUINavbar,
} from '@nextui-org/navbar'
import { Button } from '@nextui-org/button'
import { PiSignInDuotone } from 'react-icons/pi'
import Link from 'next/link'
import Image from 'next/image'
import Logo from './logo.png'
import { playfair, xw } from '@/lib/fonts'
import { useRouter } from 'next/navigation'
import { useAtomValue } from 'jotai'
import { isReaderModeAtom } from '@/app/atoms'
import { cn } from '@/lib/utils'

function Navbar({ userId }: {
	userId: string | null | undefined
}) {
	const router = useRouter()
	const isReaderMode = useAtomValue(isReaderModeAtom)

	return !isReaderMode && <NextUINavbar>
		<NavbarBrand className='space-x-2'>
			<Image src={Logo} alt='Leximory' width={32} height={32} quality={100} onClick={() => {
				router.push(userId ? '/library' : '/')
			}}></Image>
		</NavbarBrand>
		{userId && <NavbarBrand className={cn(playfair.className, 'text-3xl text-danger mx-1 justify-center hidden sm:flex')}>
			<Link href={'/library'}>Leximory</Link>
		</NavbarBrand>}
		<NavbarContent as={'div'} justify='end'>
			{
				userId ?
					<>
						<OrganizationSwitcher afterSelectPersonalUrl={'/library'} afterSelectOrganizationUrl={'/library'} createOrganizationUrl='/create' organizationProfileUrl='/org'></OrganizationSwitcher>
						<UserButton userProfileUrl='/user'></UserButton>
					</> :
					<Button as={Link} variant='flat' color='danger' href='/sign-in' radius='full' className={xw.className} startContent={<PiSignInDuotone />}>开始学习</Button>
			}
		</NavbarContent>
	</NextUINavbar>
}

export default Navbar
