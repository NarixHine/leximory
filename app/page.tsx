import Main from '@/components/ui/main'
import { auth } from '@clerk/nextjs/server'
import H from '@/components/ui/h'
import { CHINESE_CALLIGRAPHY, CHINESE_ZCOOL } from '@/lib/fonts'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import Markdown from '@/components/markdown'
import { PiFastForward, PiLinkSimpleHorizontalDuotone, PiShootingStarDuotone, PiUsersDuotone } from 'react-icons/pi'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { HydrationBoundary } from 'jotai-ssr'
import { isReadOnlyAtom, langAtom, libAtom } from './library/[lib]/atoms'
import { FlipWords } from '@/components/ui/flip'
import { lexiconAtom } from './library/[lib]/[text]/atoms'
import LexiconSelector from '@/components/lexicon'
import { Spacer } from '@nextui-org/spacer'
import { Button } from '@nextui-org/button'
import { Input } from '@nextui-org/input'
import { Card, CardBody } from '@nextui-org/card'
import ShowcaseAnnotation from '@/components/ui/showcase-annotation'
import Test from './library/[lib]/corpus/components/test'
import { ToXinhui } from './components/to-xinhui'
import LibraryCard from './marketplace/[page]/components/card'
import UserAvatar from '@/components/avatar'
import { exampleSharedLib } from '@/lib/config'

export default async function Home() {
	const { userId } = await auth()
	if (userId) {
		redirect('/library')
	}
	return <Main className={'w-11/12 max-w-screen-lg'}>
		<H className={'text-[#a49393] dark:text-default text-7xl sm:text-8xl lg:text-9xl'} usePlayfair>
			<span className='[text-shadow:_5px_5px_5px_rgb(238_214_211_/_80%)] dark:[text-shadow:none]'>Leximory</span>
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
				<Button data-umami-event='开始学习' startContent={<PiShootingStarDuotone />} color='primary' href='/sign-in' as={Link} variant='flat' size='lg' className='animate-bounce font-semibold'>开始学习</Button>
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
						<HydrationBoundary hydrateAtoms={[[lexiconAtom, 'cet6']]}>
							<LexiconSelector />
						</HydrationBoundary>
					</BentoCard>
				</div>
			</div>

			<div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
				<div className='md:col-span-2'>
					<BentoCard title='AI 注解 + AI 朗读'>
						<div className='px-8 sm:px-16'>
							<HydrationBoundary hydrateAtoms={[[lexiconAtom, 'cet6']]}>
								<ShowcaseAnnotation />
							</HydrationBoundary>
						</div>
					</BentoCard>
				</div>
				<div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-3'>
					<div>
						<BentoCard
							title='共享文库'
							description='创建学习小组，分发精读资料'
						>
							<div className='h-28 w-full bg-gradient-to-br from-secondary-50 to-warning-50 dark:from-stone-900 dark:to-stone-700 p-3 relative rounded-lg'>
								<h2 className='font-bold opacity-50'>学习小组：</h2>
								<p className='opacity-60 font-bold'>新知</p>
								<div className='absolute bottom-0 right-0 p-4'>
									<PiUsersDuotone className='w-10 h-10 opacity-30' />
								</div>
							</div>
						</BentoCard>
					</div>
					<div>
						<BentoCard
							title='语料本'
							description='以往生词汇集一处，供君复盘、自测'
						>
							<HydrationBoundary
								hydrateAtoms={[
									[libAtom, exampleSharedLib.id],
									[isReadOnlyAtom, true]
								]}
							>
								<Test latestTime={'2025-01-16'} />
							</HydrationBoundary>
						</BentoCard>
					</div>
				</div>
			</div>

			<div className='grid grid-cols-1 gap-3 md:grid-cols-3 w-full'>
				<div className='col-span-1 sm:col-span-2'>
					<BentoCard title='多语言' description='日语、文言文……'>
						<HydrationBoundary hydrateAtoms={[[langAtom, 'ja']]}>
							<Markdown
								disableSave
								md={
									'<div/>\n' +
									'> 自分は{{透き徹る||透き徹る||**［動］（すきとおる／透彻）**光が完全に通る。}}ほど深く見えるこの黒眼の色沢を眺めて、これでも死ぬのかと思った。それで、{{ねんごろ||ねんごろ||**［形動］（懇ろ／亲切）**心がこもっているさま。親切であるさま。}}に枕の傍へ口を付けて、死ぬんじゃなかろうね、大丈夫だろうね、とまた聞き返した。すると女は黒い眼を眠そうに{{睁た||睁る||**［動］（みはる／睁眼）**目を見開く。}}まま、やっぱり静かな声で、でも、死ぬんですもの、仕方がないわと云った。\n\n'
								}
							/>
						</HydrationBoundary>
					</BentoCard>
				</div>
				<div className='col-span-1'>
					<BentoCard title='文库集市' description='发现别人制作的精品学习资源'>
						<LibraryCard
							avatar={<UserAvatar uid={exampleSharedLib.owner} />}
							library={exampleSharedLib}
							isStarred={false}
						/>
					</BentoCard>
				</div>
			</div>
		</div>

		<Spacer y={12}></Spacer>

		<div className='prose dark:prose-invert max-w-xl mx-auto'>
			<p><b>“——为什么我们学不好英语？”</b></p>
			<p>我们花费了太多时间在背单词、记语法的这条所谓大道上兜兜转转，耗费了精力，却无功而返。可要是我们问自己：我们在“学”中文的时候记过单词、文法吗？答案当然是“从来没有过”，婴儿时听到的大量对话、交谈等“素材”自然构成了我们作为母语者的超凡语感。</p>
			<p>学英语为何不能如此？太多的语言学研究表明了输入大量的语言“素材”是语言习得最有效、也最稳固的方式，从海量素材里人的大脑会自然探索出文法之规律、语汇的意义。应当阅读语料来学词汇、文法；试图学语汇、文法来理解语言，岂不颠之倒之？</p>
			<p>这是在说我们不该学词汇和文法吗？当然不是，它们是语言习得进程的关键辅助，然而也仅仅是辅助。拿文法来说：记诵讲义上的句式，好比生搬硬套公式。换一个情景呢？换一个句子呢？如果需要愣一下才能磕磕绊绊地说出一个句型也不算掌握：说话不是数学题，语言的流露不需要思考，思考便说明只是记住了，不知是否记牢了，更不知是否内化于说话者的直觉了。文法可以看成星罗棋布的岛屿之间的桥梁：它应该一点即通，它要求你已经通过大量阅读建立起了语言直觉的岛屿；它的学习可以使你融会贯通，却无法在那些岛屿本就不存在的情况下构建直觉。类似地，对于词汇，我们可以说：记忆词汇是手段，心会词汇才是目的。</p>
			<p>那么，正确的路径绝对是以广泛阅读为纲，文法、语源等技巧为工具。</p>
			<p>于是我们开发了 Leximory 这个网站，宗旨即“从记忆到心会——语言学地学语言”：</p>
			<ul>
				<li>通过网页链接或复制粘贴导入文本，AI 自动划出生词，考纲词汇一键查询，一键保存，助你更好吸收。</li>
				<li>附带精辟语源，以一个学多个，以英文学英文，实现融会贯通。</li>
				<li>进入语料本，复习已保存的词汇，强化印象；随机抽取，对过去记忆的语汇自我检测。</li>
				<li>创建学习小组，制作成套资料并分发给指定用户；或利用打印模式，将侧边栏注释同文本一起印出来。</li>
				<li>利用 AI 音频生成边听边读，充分激活大脑不同语言认知模块。</li>
			</ul>
			<p>语言不仅是交流的工具，更是思想的媒介、文化的载体、心灵间的信使。学习语言是一场对于异域的陌生的接触，本是陶冶性情、快意宜人的。</p>
			<p>我们想要打造的不仅仅是一个高效的工具，更希望 Leximory 上的学习过程能够发现语言学习本来的面目。<Link href='/about' className='items-center gap-1 font-semibold underline-offset-4 inline-flex'>了解更多<PiFastForward /></Link></p>
		</div>

		<Spacer y={8}></Spacer>

		<ToXinhui />
	</Main >
}

const BentoCard = ({ title, children, description, }: {
	title: string,
	children: ReactNode,
	description?: string,
}) => {
	return <Card shadow='sm' className={'w-full h-full'}>
		<CardBody className='p-5'>
			<H className={cn(CHINESE_ZCOOL.className, 'text-2xl', !description && 'mb-2')} disableCenter>
				{title}
			</H>
			{description && <div className='text-sm mb-2'>{description}</div>}
			<div className='w-full h-full flex justify-center items-center'>
				{children}
			</div>
		</CardBody>
	</Card>
}
