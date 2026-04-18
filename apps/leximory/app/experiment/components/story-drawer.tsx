'use client'

import { Drawer } from 'vaul'
import { motion } from 'framer-motion'
import Markdown from '@/components/markdown'

interface StoryDrawerProps {
    isOpen: boolean
    onClose: () => void
    content?: string
}

export function StoryDrawer({ isOpen, onClose, content }: StoryDrawerProps) {
    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Content
                    className="fixed inset-x-0 bottom-0 z-50 rounded-t-4xl justify-center flex outline-none"
                    style={{ maxHeight: '85vh' }}
                >
                    <div className="px-8 pt-5 pb-10 bg-background mx-auto max-w-xl rounded-t-4xl border border-default-200">
                        {/* Handle bar */}
                        <div className="mx-auto w-12 h-1.5 bg-default-200 rounded-full mb-6" />

                        {/* Header */}
                        <div className="flex items-center justify-between mb-4 max-w-160 mx-auto">
                            <h2 className="text-xl font-semibold text-default-800">Story</h2>
                        </div>

                        {/* Content with max-width like article page */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="mx-auto"
                        >
                            {content ? (
                                <Markdown
                                    md={`<article>\n${content}\n</article>`}
                                    disableSave
                                />
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
