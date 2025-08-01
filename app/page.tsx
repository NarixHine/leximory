import Main from '@/components/ui/main'
import H from '@/components/ui/h'
import { CHINESE_CALLIGRAPHY } from '@/lib/fonts'
import Link from 'next/link'
import Markdown from '@/components/markdown'
import Methodology from './blog/(posts)/from-memorisation-to-acquisition/methodology.mdx'
import { PiLinkSimpleHorizontalDuotone, PiShootingStarDuotone, PiNewspaperDuotone } from 'react-icons/pi'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { HydrationBoundary } from 'jotai-ssr'
import { isReadOnlyAtom, langAtom, libAtom } from './library/[lib]/atoms'
import { FlipWords } from '@/components/ui/flip'
import LexiconSelector from '@/components/lexicon'
import { Spacer } from "@heroui/spacer"
import { Button } from "@heroui/button"
import { Input } from "@heroui/input"
import { Card, CardBody } from "@heroui/card"
import ShowcaseAnnotation from '@/components/ui/showcase-annotation'
import Test from './library/[lib]/corpus/components/test'
import LibraryCard from './marketplace/[page]/components/card'
import UserAvatar from '@/components/avatar'
import { exampleSharedLib, SIGN_IN_URL } from '@/lib/config'
import ScopeProvider from '@/components/jotai/scope-provider'
import { isAtRead } from '@/lib/subapp'
import { redirect } from 'next/navigation'
import { TextHoverEffect } from '@/components/ui/text-hover-effect'

export default async function Home() {
	if (await isAtRead()) {
		redirect('/times')
	}
	return <Main className={'w-11/12 max-w-(--breakpoint-lg)'}>
		<H className={'text-[#a49393] dark:text-default text-7xl sm:text-8xl lg:text-9xl italic'} fancy>
			<span className='[text-shadow:5px_5px_5px_rgb(238_214_211/80%)] dark:[text-shadow:none]'>Leximory</span>
		</H>

		<Spacer y={5}></Spacer>

		<div className='flex justify-center items-center space-x-2'>
			<div>
				<H className={'text-2xl sm:text-3xl animate-in fade-in slide-in-from-bottom-10 duration-1000'}>
					语言学地学语言
				</H>
				<H className={'text-lg sm:text-xl animate-in fade-in slide-in-from-bottom-10 duration-1000 hidden sm:block'}>
					集中输入·轻松复盘·听读结合
				</H>
			</div>
			<div className='flex justify-center items-center'>
				<Button startContent={<PiShootingStarDuotone />} color='primary' href={SIGN_IN_URL} as={Link} variant='flat' size='lg' className='animate-bounce font-semibold'>开始学习</Button>
			</div>
		</div>

		<Spacer y={10}></Spacer>

		<div className={cn(CHINESE_CALLIGRAPHY.className, 'text-5xl sm:text-6xl mb-4 text-center')}>
			助力<FlipWords words={['外刊', '文摘', '书籍', '古文']} />阅读
		</div>
		<div className='grid w-full gap-3'>
			<div className='grid grid-cols-1 sm:grid-cols-5 gap-3'>
				<div className='col-span-2'>
					<BentoCard title='外刊一键导入'>
						<div className='flex w-full'>
							<Input
								className='flex-1'
								label='网址'
								placeholder='https://example.com/'
								variant='underlined'
								color='secondary'
							/>
							<div className='flex flex-col-reverse'>
								<Button
									color='primary'
									radius='full'
									endContent={<PiLinkSimpleHorizontalDuotone />}
									variant='flat'
								>
									读取
								</Button>
							</div>
						</div>
					</BentoCard>
				</div>
				<div className='col-span-3'>
					<BentoCard title='考纲词汇高亮'>
						<LexiconSelector />
					</BentoCard>
				</div>
			</div>

			<div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
				<div className='md:col-span-2'>
					<BentoCard title='AI 注解 + AI 朗读'>
						<div className='px-8 sm:px-16 flex flex-col'>
							<ShowcaseAnnotation />
						</div>
					</BentoCard>
				</div>
				<div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-3'>
					<div>
						<BentoCard
							title='每日资源'
							description='每日更新的英语新闻和小说'
						>
							<Card isPressable as={Link} href='/times' shadow='none' className='h-28 w-full bg-linear-to-br from-zinc-100 to-neutral-50 dark:from-stone-900 dark:to-stone-700 p-2 relative rounded-lg'>
								<CardBody>
									<h2 className='font-bold opacity-50 text-xs'>The Leximory Times</h2>
									<p className='opacity-60 font-bold'>24 March, 2025</p>
									<div className='absolute bottom-0 right-0 p-2'>
										<PiNewspaperDuotone className='w-10 h-10 opacity-30' />
									</div>
								</CardBody>
							</Card>
						</BentoCard>
					</div>
					<div>
						<BentoCard
							title='语料本'
							description='以往生词汇集一处，供君复盘、自测'
						>
							<ScopeProvider atoms={[libAtom, isReadOnlyAtom]}>
								<HydrationBoundary
									hydrateAtoms={[
										[libAtom, exampleSharedLib.id],
										[isReadOnlyAtom, true]
									]}
								>
									<Test latestTime={'2025-01-16'} />
								</HydrationBoundary>
							</ScopeProvider>
						</BentoCard>
					</div>
				</div>
			</div>

			<div className='grid grid-cols-1 gap-3 md:grid-cols-3 w-full'>
				<div className='col-span-1 sm:col-span-2'>
					<BentoCard title='多语言' description='日语、文言文……'>
						<ScopeProvider atoms={[langAtom]}>
							<HydrationBoundary hydrateAtoms={[[langAtom, 'ja']]}>
								<Markdown
									disableSave
									md={
										'<div/>\n' +
										'> 自分は{{透き徹る||透き徹る||**［動］（すきとおる／透彻）**光が完全に通る。}}ほど深く見えるこの黒眼の色沢を眺めて、これでも死ぬのかと思った。それで、{{ねんごろ||ねんごろ||**［形動］（懇ろ／亲切）**心がこもっているさま。親切であるさま。}}に枕の傍へ口を付けて、死ぬんじゃなかろうね、大丈夫だろうね、とまた聞き返した。すると女は黒い眼を眠そうに{{見張た||見張る||**［動］（みはる／睁眼）**目を見開く。}}まま、やっぱり静かな声で、でも、死ぬんですもの、仕方がないわと云った。\n\n'
									}
								/>
							</HydrationBoundary>
						</ScopeProvider>
					</BentoCard>
				</div>
				<div className='col-span-1'>
					<BentoCard title='文库集市' description='发现别人制作的精品学习资源'>
						<LibraryCard
							isOwner={false}
							avatar={<UserAvatar uid={exampleSharedLib.owner} />}
							library={exampleSharedLib}
							isStarred={false}
						/>
					</BentoCard>
				</div>
			</div>
		</div>

		<Spacer y={12}></Spacer>

		<div className='flex justify-center items-center gap-4 lg:flex-row flex-col'>
			<div className='w-full'>
				<H className='text-3xl mb-2 font-bold'>核心功能</H>
				<iframe className='rounded-xl w-full aspect-video' src='//player.bilibili.com/player.html?isOutside=true&aid=114210461845887&bvid=BV1m1X8YuEDg&cid=29024977489&p=1&muted=true' allowFullScreen></iframe>
			</div>
			<div className='w-full'>
				<H className='text-3xl mb-2 font-semibold' fancy>AI Agent</H>
				<iframe className='rounded-xl w-full aspect-video' src='//player.bilibili.com/player.html?isOutside=true&aid=114606102153816&bvid=BV1g873z5EPJ&cid=30261575913&p=1&muted=true' allowFullScreen></iframe>
			</div>
		</div>

		<Spacer y={12}></Spacer>

		<div className='prose prose-lg dark:prose-invert max-w-xl mx-auto'>
			<Methodology />
		</div>

		<Spacer y={5}></Spacer>

		<Card shadow='none' isBlurred isPressable prefetch as={Link} href={SIGN_IN_URL}>
			<CardBody className='flex flex-col items-center justify-center pb-0 pt-6 md:pt-8'>
				<TextHoverEffect text={'从记忆'} />
				<TextHoverEffect text={'到心会'} />
			</CardBody>
		</Card>
	</Main >
}

const BentoCard = ({ title, children, description, }: {
	title: string,
	children: ReactNode,
	description?: string,
}) => {
	return <Card shadow='sm' className={'w-full h-full'}>
		<CardBody className='p-5'>
			<H className={cn('text-2xl', !description && 'mb-2')} disableCenter>
				{title}
			</H>
			{description && <div className='text-sm mb-2'>{description}</div>}
			<div className='w-full h-full flex justify-center items-center'>
				{children}
			</div>
		</CardBody>
	</Card>
}
