'use client'

import { OrganizationSwitcher, useAuth, UserButton, useUser } from '@clerk/nextjs'
import {
	NavbarBrand,
	NavbarContent,
	Navbar as NextUINavbar,
	Button
} from '@nextui-org/react'
import { PiKeyBold, PiSignInDuotone } from 'react-icons/pi'
import Link from 'next/link'
import Image from 'next/image'
import Logo from './logo.png'
import { ENGLISH_PLAYFAIR, CHINESE_ZCOOL } from '@/lib/fonts'
import { useRouter } from 'next/navigation'
import { useAtomValue } from 'jotai'
import { isReaderModeAtom } from '@/app/atoms'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

function Navbar({ userId: defaultUserId }: {
	userId: string | null | undefined
}) {
	const user = useUser()
	const userId = user.isLoaded ? user.user?.id : defaultUserId
	const router = useRouter()
	const isReaderMode = useAtomValue(isReaderModeAtom)
	const { getToken } = useAuth()

	return !isReaderMode && <div className='px-10 pt-3 pb-1 sticky top-0 z-20'>
		<NextUINavbar className='rounded-full border-1.5 border-primary-300/50 dark:border-danger-100/50 h-14'>
			<NavbarBrand className='space-x-2'>
				<Image src={Logo} alt='Leximory' width={24} height={24} quality={100} onClick={() => {
					router.push(userId ? '/library' : '/')
				}}></Image>
			</NavbarBrand>
			{userId && <NavbarBrand className={cn(ENGLISH_PLAYFAIR.className, 'text-2xl text-danger mx-1 justify-center hidden sm:flex')}>
				<Link href={'/library'}>Leximory</Link>
			</NavbarBrand>}
			<NavbarContent as={'div'} justify='end'>
				{
					userId ?
						<>
							<OrganizationSwitcher afterSelectPersonalUrl={'/library'} afterSelectOrganizationUrl={'/library'} createOrganizationUrl='/create' organizationProfileUrl='/org'></OrganizationSwitcher>
							<UserButton userProfileUrl='/user'>
								<UserButton.MenuItems>
									<UserButton.Action
										label='拷贝通行密钥'
										labelIcon={<PiKeyBold size={16} />}
										onClick={() => {
											const toastId = toast.loading('获取密钥中...', { duration: 1000 })
											getToken({ template: 'shortcut' }).then(async token => {
												if (navigator.clipboard && token) {
													navigator.clipboard.writeText(token)
														.then(() => {
															toast.dismiss(toastId)
															toast.success('可以将密钥粘贴到 iOS Shortcuts 中了！')
														})
														.catch(() => {
															toast.dismiss(toastId)
															toast.error('复制失败')
														})
												} else {
													toast.dismiss(toastId)
													toast.error('复制失败')
												}
											})
										}}
									/>
								</UserButton.MenuItems>
							</UserButton>
						</> :
						<Button as={Link} variant='flat' color='danger' href='/sign-in' radius='full' className={CHINESE_ZCOOL.className} startContent={<PiSignInDuotone />}>开始学习</Button>
				}
			</NavbarContent>
		</NextUINavbar>
	</div>
}

export default Navbar
