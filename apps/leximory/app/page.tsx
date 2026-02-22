import Main from '@/components/ui/main'
import H from '@/components/ui/h'
import Markdown from '@/components/markdown'
import Methodology from './blog/(posts)/from-memorisation-to-acquisition/methodology.mdx'
import {
	PiLinkSimpleHorizontalDuotone,
	PiShootingStarDuotone,
	PiNewspaperDuotone,
} from 'react-icons/pi'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { HydrationBoundary } from 'jotai-ssr'
import { isReadOnlyAtom, langAtom, libAtom } from './library/[lib]/atoms'
import LexiconSelector from '@/components/lexicon'
import { Spacer } from '@heroui/spacer'
import { Button } from '@heroui/button'
import { Input } from '@heroui/input'
import { Card, CardBody } from '@heroui/card'
import ShowcaseAnnotation from '@/components/ui/showcase-annotation'
import Test from './library/[lib]/corpus/components/test'
import LibraryCard from './marketplace/[page]/components/card'
import { EXAMPLE_SHARED_LIB, SIGN_IN_URL } from '@repo/env/config'
import ScopeProvider from '@/components/jotai/scope-provider'
import { TextHoverEffect } from '@/components/ui/text-hover-effect'
import LinkButton from '@repo/ui/link-button'
import LinkCard from '@/components/ui/link-card'
import HeroImportUI from '@/components/ui/hero-import'

export default async function Home() {

	return (
		<div className='min-h-screen'>
			{/* Hero Section - Full Viewport Height */}
			<section className='h-screen flex items-center justify-center'>
				<div className='w-full max-w-4xl px-6'>
					<div className='flex flex-col items-center justify-center min-h-full'>
						<div className='flex-1 flex items-center'>
							<HeroImportUI />
						</div>
					</div>
				</div>
			</section>

			{/* Rest of the Current Landing Page */}
			<section id='content-section' className='bg-background'>
				<Main className={'w-11/12 max-w-(--breakpoint-lg)'}>
					<div>
						<H className={'text-default-400 text-8xl lg:text-9xl italic text-center'} fancy>
							Leximory
						</H>

						<Spacer y={5}></Spacer>

						<div className='flex flex-col sm:flex-row justify-center items-center gap-3'>
							<div>
								<H className={'text-2xl font-bold sm:text-3xl animate-in fade-in slide-in-from-bottom-10 duration-1000'}>
									语言学地学语言。
								</H>
								<H className={'text-base sm:text-lg animate-in fade-in slide-in-from-bottom-10 duration-1000 hidden sm:block'}>
									集中输入、轻松复盘、听读结合
								</H>
							</div>
							<div className='flex justify-center items-center'>
								<LinkButton startContent={<PiShootingStarDuotone />} radius='full' color='primary' href={SIGN_IN_URL} size='lg' className='animate-bounce font-semibold'>
									开始学习
								</LinkButton>
							</div>
						</div>

						<Spacer y={10}></Spacer>

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
												color='default'
											/>
											<div className='flex flex-col-reverse'>
												<Button
													color='default'
													radius='full'
													endContent={<PiLinkSimpleHorizontalDuotone />}
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

							<div className='grid grid-cols-1 laptop:grid-cols-3 gap-3'>
								<div className='md:col-span-2'>
									<BentoCard title='AI 注解 + AI 朗读'>
										<div className='px-8 sm:px-16 flex flex-col'>
											<ShowcaseAnnotation />
										</div>
									</BentoCard>
								</div>
								<div className='grid grid-cols-1 laptop:grid-cols-1 max-laptop:sm:grid-cols-2 gap-3'>
									<div>
										<BentoCard
											title='一键分享'
											description='将导入的文本分享给好友。无需登录。'
										>
											<LinkCard isPressable href='/read/ec50a3f1' shadow='none' className='h-32 w-full bg-linear-to-br from-secondary-100 to-default-200 p-2 relative rounded-2xl'>
												<CardBody>
													<h2 className='text-default-500 text-sm tracking-wider'>The New York Times</h2>
													<p className='text-base text-default-700 text-balance font-formal my-1'>Signature of Life on a Distant Planet</p>
													<div className='absolute bottom-0 right-0 p-0'>
														<PiNewspaperDuotone className='w-10 h-10 text-default-300' />
													</div>
												</CardBody>
											</LinkCard>
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
														[libAtom, EXAMPLE_SHARED_LIB.id],
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
											library={EXAMPLE_SHARED_LIB}
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

						<LinkCard shadow='none' isBlurred isPressable prefetch href={SIGN_IN_URL}>
							<CardBody className='flex flex-col items-center justify-center pb-0 pt-6 md:pt-8'>
								<TextHoverEffect text={'从记忆'} />
								<TextHoverEffect text={'到心会'} />
							</CardBody>
						</LinkCard>
					</div>
				</Main>
			</section>
		</div>
	)
}

const BentoCard = ({ title, children, description, }: {
	title: string,
	children: ReactNode,
	description?: string,
}) => {
	return <Card shadow='none' className={'w-full h-full bg-default-50/50 rounded-4xl'}>
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
