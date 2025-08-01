import Markdown from '@/components/markdown'
import H from '@/components/ui/h'
import { getForgetCurve } from '@/server/db/word'
import StoryGen from './story-gen'
import { ForgetCurvePoint, supportedLangs } from '@/lib/config'
import { HydrationBoundary } from 'jotai-ssr'
import { langAtom, libAtom } from '@/app/library/[lib]/atoms'
import ScopeProvider from '@/components/jotai/scope-provider'
import { getUserOrThrow } from '@/server/auth/user'


export default async function Report({ day }: {
    day: ForgetCurvePoint
}) {
    const { userId } = await getUserOrThrow()
    const words = await getForgetCurve({ day, userId })
    return words.length > 0 ? (
        <div className='my-8'>
            <div className='flex gap-3 items-start'>
                <H disableCenter className='text-xl font-bold opacity-80 -mb-2'>{day}</H>
                {supportedLangs.filter((lang) => words.some((word) => word.lang === lang)).map((lang) => (
                    <StoryGen key={lang} comments={words.filter((word) => word.lang === lang).map(({ word }) => word)} lang={lang} />
                ))}
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {words.map(({ word, id, lang, lib }) => (
                    <ScopeProvider key={id} atoms={[langAtom]}>
                        <HydrationBoundary hydrateAtoms={[[langAtom, lang], [libAtom, lib]]}>
                                <Markdown md={word} asCard deleteId={id}></Markdown>
                        </HydrationBoundary>
                    </ScopeProvider>
                ))}
            </div>
        </div>
    ) : <></>
}
