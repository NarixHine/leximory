import Markdown from '@/components/markdown'
import H from '@/components/ui/h'
import { getForgetCurve } from '@/server/db/word'
import StoryGen from './story-gen'
import { ForgetCurvePoint, SUPPORTED_LANGS } from '@repo/env/config'
import { HydrationBoundary } from 'jotai-ssr'
import { langAtom, libAtom } from '@/app/library/[lib]/atoms'
import ScopeProvider from '@/components/jotai/scope-provider'
import { getUserOrThrow } from '@repo/user'

export default async function Report({ day }: {
    day: ForgetCurvePoint
}) {
    const { userId } = await getUserOrThrow()
    const words = await getForgetCurve({ day, userId })
    return words.length > 0 ? (
        <div className='my-10'>
            <div className='flex flex-row items-center mb-4'>
                <div className='flex-1 h-px bg-secondary-300/70 mr-5' />
                <h2 className='flex items-center font-bold text-lg tracking-widest text-secondary-400 mx-auto w-108 sm:w-133'>
                    <div className='flex gap-1 items-center'>
                        <div className='text-xl font-bold opacity-80'>{day}</div>
                        {SUPPORTED_LANGS.filter((lang) => words.some((word) => word.lang === lang)).map((lang) => (
                            <StoryGen key={lang} comments={words.filter((word) => word.lang === lang).map(({ word }) => word)} lang={lang} />
                        ))}
                    </div>
                    <div className='flex-1 ml-3 h-px bg-secondary-300/70' />
                </h2>
                <div className='flex-1 h-px bg-secondary-300/70' />
            </div>

            <div className='columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4'>
                {words.map(({ word, id, lang, lib }) => (
                    <ScopeProvider key={id} atoms={[langAtom, libAtom]}>
                        <HydrationBoundary hydrateAtoms={[[langAtom, lang], [libAtom, lib]]}>
                            <Markdown md={word} asCard deleteId={id}></Markdown>
                        </HydrationBoundary>
                    </ScopeProvider>
                ))}
            </div>
        </div>
    ) : <></>
}
