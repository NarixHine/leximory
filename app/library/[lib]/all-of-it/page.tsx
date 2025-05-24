import Main from '@/components/ui/main'
import Nav from '@/components/nav'
import { getAllTextsInLib } from '@/server/db/lib'
import { getLib } from '@/server/db/lib'
import { HydrationBoundary } from 'jotai-ssr'
import ScopeProvider from '@/components/jotai/scope-provider'
import { allOfItAtom } from './atoms'
import Topics from '../[text]/components/topics'
import EditableH from '../[text]/components/editable-h'
import { titleAtom, contentAtom, topicsAtom, textAtom } from '../[text]/atoms'
import { cn } from '@/lib/utils'
import Markdown from '@/components/markdown'
import { postFontFamily } from '@/lib/fonts'

export async function generateMetadata({ params }: { params: Promise<{ lib: string }> }) {
    const lib = await getLib({ id: (await params).lib })
    return {
        title: `${lib.name} - 所有文章`
    }
}

export default async function AllOfItPage({ params }: { params: Promise<{ lib: string }> }) {
    const p = await params
    const [lib, texts] = await Promise.all([
        getLib({ id: p.lib }),
        getAllTextsInLib({ libId: p.lib })
    ])

    return (
        <Main className='max-w-screen-xl'>
            <Nav lib={{ id: lib.id, name: lib.name }}></Nav>
            {texts.map(text => (
                <div key={text.id} className='space-y-4 print:break-inside-avoid'>
                    <ScopeProvider atoms={[titleAtom, contentAtom, topicsAtom, textAtom, allOfItAtom]}>
                        <HydrationBoundary hydrateAtoms={[
                            [titleAtom, text.title],
                            [contentAtom, text.content],
                            [topicsAtom, text.topics],
                            [textAtom, text.id],
                            [allOfItAtom, true]
                        ]}>
                            <div className='flex flex-col justify-left w-3/5 mt-8 first:mt-0'>
                                <EditableH />
                                <Topics topics={text.topics} className='justify-center'></Topics>
                            </div>
                            <Markdown
                                className={cn(
                                    'w-3/5 block',
                                    '!prose-lg text-pretty'
                                )}
                                fontFamily={lib.lang === 'en' ? postFontFamily : undefined}
                                md={`<article>${text.content}</article>`}
                            />
                        </HydrationBoundary>
                    </ScopeProvider>
                </div>
            ))}
        </Main>
    )
} 