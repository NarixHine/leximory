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
        <div className='my-8'>
            <div className='flex gap-3 items-start px-4.5 mb-3'>
                <h2 className='text-xl font-bold opacity-80 -mb-2'>{day}</h2>
                {SUPPORTED_LANGS.filter((lang) => words.some((word) => word.lang === lang)).map((lang) => (
                    <StoryGen key={lang} comments={words.filter((word) => word.lang === lang).map(({ word }) => word)} lang={lang} />
                ))}
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
