import Main from '@/components/ui/main'
import H from '@/components/ui/h'
import Markdown from '@/components/markdown'
import {
	PiLinkSimpleHorizontalDuotone,
	PiNewspaperDuotone,
	PiShootingStarDuotone,
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
import LinkCard from '@/components/ui/link-card'
import HeroSection from '@/components/hero'
import StorySection from '@/components/hero/story-section'
import LinkButton from '@repo/ui/link-button'
import { CatSprite } from './review/components/cat-sprite'

export default async function Home() {

	return (
		<div>
			<HeroSection />
			<StorySection />

			{/* Rest of the Current Landing Page */}
			<section>
				<Main className={'w-11/12 max-w-(--breakpoint-lg)'}>
					<H className='text-3xl sm:text-4xl mb-4'>Leximory&nbsp;<span className='font-semibold'>助你一臂之力。</span></H>
					<div>
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

						<div className='flex justify-center items-center'>
							<div className='w-full'>
								<H className='text-3xl mb-2 font-bold'>核心功能演示</H>
								<iframe className='rounded-xl w-full aspect-video' src='//player.bilibili.com/player.html?isOutside=true&aid=114210461845887&bvid=BV1m1X8YuEDg&cid=29024977489&p=1&muted=true' allowFullScreen></iframe>
							</div>
						</div>
					</div>

					<Spacer y={12}></Spacer>

					<div className='flex justify-center items-center flex-wrap'>
						<LinkButton startContent={<PiShootingStarDuotone className='text-lg' />} radius='full' color='primary' href={SIGN_IN_URL} className='font-semibold'>
							开始
						</LinkButton>
						<div className='text-lg font-semibold ml-2 flex justify-center items-center'>和小白猫<div className='h-16 w-30 -ml-3 -mr-9 inline-block'>
							<CatSprite variant={'white'} frame='idle' className='drop-shadow-2xl' />
						</div>一起学习语言。</div>
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
			{description && <div className='text-sm mb-2 text-secondary-400'>{description}</div>}
			<div className='w-full h-full flex justify-center items-center'>
				{children}
			</div>
		</CardBody>
	</Card>
}
