'use client'

import HeroLawn from './hero-lawn'
import LinkButton from '@repo/ui/link-button'
import { Button } from '@heroui/button'
import { PiShootingStarDuotone, PiArrowDownDuotone } from 'react-icons/pi'
import { SIGN_IN_URL } from '@repo/env/config'

export default function HeroSection() {
	return (
		<section className='min-h-[85dvh] flex flex-col justify-center px-6 pt-24 pb-12'>
			<div className='max-w-5xl w-full mx-auto'>
				<div className='flex items-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-800 mb-4'>
					<div className='size-24 rounded-4xl border-5 border-default-100 dark:border-default-400/40 flex items-center justify-center shrink-0 overflow-hidden bg-default-100 dark:bg-default-100/20'>
						<img
							src='/icon.png'
							alt='Leximory'
							className='w-full h-full object-cover'
						/>
					</div>

					<div className='justify-between flex flex-col h-full gap-0.5'>
						<h1 className='text-4xl sm:text-5xl font-fancy tracking-tight text-default-800'>
							<span>Leximory</span> <span className='text-xl sm:text-[1.72rem] font-bold'>猫忆</span>
						</h1>
						<p className='text-lg text-default-500 font-kaiti'>
							语言学地学语言
						</p>
					</div>
				</div>

				<p
					className='text-lg text-foreground-400 text-balance max-w-xl leading-relaxed mb-4 animate-blur-in font-ui font-semibold'
					style={{ animationDelay: '150ms' }}
				>
					<span className='font-fancy text-xl font-normal text-primary'>Leximory</span> 是一个搭载
					<span className='font-fancy text-xl italic bg-linear-to-r from-pink-300 to-sky-400 bg-clip-text text-transparent'> AI </span>
					的语言学习平台，旨在通过整合
					<span className='text-primary underline underline-offset-4'>文本泛读</span>
					、
					<span className='text-primary underline underline-offset-4'>生词释义</span>
					和
					<span className='text-primary underline underline-offset-4'>词汇复习</span>
					以最大化语言习得效率。
				</p>

				<div className='flex gap-3 mb-8 animate-in fade-in slide-in-from-bottom-6 duration-800 fill-mode-both' style={{ animationDelay: '350ms' }}>
					<LinkButton startContent={<PiShootingStarDuotone />} radius='full' color='primary' href={SIGN_IN_URL} size='lg' className='font-semibold'>
						开始学习
					</LinkButton>
					<Button
						radius='full'
						variant='flat'
						color='default'
						size='lg'
						className='font-semibold'
						endContent={<PiArrowDownDuotone />}
						onPress={() => document.getElementById('content-section')?.scrollIntoView({ behavior: 'smooth' })}
					>
						了解更多
					</Button>
				</div>

				<div className='w-full animate-in fade-in slide-in-from-bottom-6 duration-800 fill-mode-both' style={{ animationDelay: '550ms' }}>
					<HeroLawn />
				</div>
			</div>
		</section>
	)
}
