'use client'

import { Drawer } from 'vaul'
import { motion } from 'framer-motion'
import Markdown from '@/components/markdown'
import { ScopeProvider } from 'jotai-scope'
import { HydrationBoundary } from 'jotai-ssr'
import { langAtom } from '@/app/library/[lib]/atoms'
import { Lang } from '@repo/env/config'

interface StoryDrawerProps {
    isOpen: boolean
    onClose: () => void
    content?: string
    lang: string
}

export function StoryDrawer({ isOpen, onClose, content, lang }: StoryDrawerProps) {
    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Content
                    className="fixed inset-x-0 bottom-0 z-50 rounded-t-4xl justify-center flex outline-none"
                    style={{ maxHeight: '85vh' }}
                >
                    <div className="px-8 pt-5 pb-10 bg-background mx-auto max-w-xl rounded-t-4xl border border-default-200">
                        {/* Handle bar */}
                        <div className="mx-auto w-12 h-1.5 bg-default-200 rounded-full -mb-2" />

                        {/* Content with max-width like article page */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="mx-auto"
                        >
                            {content ? (
                                <ScopeProvider atoms={[langAtom]}>
                                    <HydrationBoundary hydrateAtoms={[[langAtom, lang as Lang]]}>
                                        <Markdown
                                            md={`<article>\n${content}\n</article>`}
                                            disableSave
                                        />
                                    </HydrationBoundary>
                                </ScopeProvider>
                            ) : (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </motion.div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    )
}
