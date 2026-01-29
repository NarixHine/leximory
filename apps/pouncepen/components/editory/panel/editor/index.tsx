'use client'

import FishingEditor from './fishing'
import ClozeEditor from './cloze'
import GrammarEditor from './grammar'
import SentenceChoiceEditor from './sentence'
import ReadingEditor from './reading'
import ListeningEditor from './listening'
import CustomTextEditor from './custom'
import { useAtom, useAtomValue } from 'jotai'
import { isChatAtom } from '../atoms'
import ChatInterface from './chat'
import { QuizData } from '@repo/schema/paper'
import { editoryItemsAtom } from '@repo/ui/paper/atoms'

export default function Editor({ id }: { id?: string }) {
    const [items, setItems] = useAtom(editoryItemsAtom)
    const isChat = useAtomValue(isChatAtom)
    const setData = (data: QuizData) => setItems((prevItems) => prevItems.map((item) => item.id === data.id ? data : item))

    if (isChat) {
        return <div className='flex-1 flex flex-col border-secondary-400/20 border-4 min-h-[calc(88vh)] lg:max-w-[45vw] p-4 rounded-medium'>
            <ChatInterface />
        </div>
    }

    return <div className='flex-1 border-secondary-400/20 border-4 min-h-[calc(88vh)] lg:max-w-[45vw] p-4 rounded-medium'>
        {
            items.map((data) => {
                switch (data.type) {
                    case 'fishing':
                        return <FishingEditor
                            key={data.id}
                            data={data}
                            setData={setData}
                            id={id}
                        />

                    case 'cloze':
                        return <ClozeEditor
                            key={data.id}
                            data={data}
                            setData={setData}
                            id={id}
                        />

                    case 'grammar':
                        return <GrammarEditor
                            key={data.id}
                            data={data}
                            setData={setData}
                            id={id}
                        />

                    case 'sentences':
                        return <SentenceChoiceEditor
                            key={data.id}
                            data={data}
                            setData={setData}
                            id={id}
                        />

                    case 'reading':
                        return <ReadingEditor
                            key={data.id}
                            data={data}
                            setData={setData}
                            id={id}
                        />

                    case 'listening':
                        return <ListeningEditor
                            key={data.id}
                            data={data}
                            setData={setData}
                            id={id}
                        />

                    case 'custom':
                        return <CustomTextEditor
                            key={data.id}
                            data={data}
                            setData={setData}
                            id={id}
                        />

                    default:
                        break
                }
            })
        }
    </div>
}