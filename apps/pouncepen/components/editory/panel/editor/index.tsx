'use client'

import FishingEditor from './fishing'
import ClozeEditor from './cloze'
import GrammarEditor from './grammar'
import SentenceChoiceEditor from './sentence'
import ReadingEditor from './reading'
import ListeningEditor from './listening'
import CustomTextEditor from './custom'
import SummaryEditor from './summary'
import TranslationEditor from './translation'
import WritingEditor from './writing'
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
                let editor: React.ReactNode
                switch (data.type) {
                    case 'fishing':
                        editor = <FishingEditor data={data} setData={setData} id={id} />
                        break
                    case 'cloze':
                        editor = <ClozeEditor data={data} setData={setData} id={id} />
                        break
                    case 'grammar':
                        editor = <GrammarEditor data={data} setData={setData} id={id} />
                        break
                    case 'sentences':
                        editor = <SentenceChoiceEditor data={data} setData={setData} id={id} />
                        break
                    case 'reading':
                        editor = <ReadingEditor data={data} setData={setData} id={id} />
                        break
                    case 'listening':
                        editor = <ListeningEditor data={data} setData={setData} id={id} />
                        break
                    case 'custom':
                        editor = <CustomTextEditor data={data} setData={setData} id={id} />
                        break
                    case 'summary':
                        editor = <SummaryEditor data={data} setData={setData} id={id} />
                        break
                    case 'translation':
                        editor = <TranslationEditor data={data} setData={setData} id={id} />
                        break
                    case 'writing':
                        editor = <WritingEditor data={data} setData={setData} id={id} />
                        break
                    default:
                        return null
                }
                return <div key={data.id} id={`section-${data.id}`}>{editor}</div>
            })
        }
    </div>
}