'use client'

import { Dispatch, SetStateAction } from 'react'
import FishingEditor from './fishing'
import ClozeEditor from './cloze'
import GrammarEditor from './grammar'
import SentenceChoiceEditor from './sentence'
import ReadingEditor from './reading'
import ListeningEditor from './listening'
import CustomTextEditor from './custom'
import QuizData from '../../generators/types'

export default function Editor({ items, setItems, id }: { items: QuizData[], setItems: Dispatch<SetStateAction<QuizData[]>>, id?: string }) {
    const setData = (data: QuizData) => setItems((prevItems) => prevItems.map((item) => item.id === data.id ? data : item))
    return <div className='flex-1 border-default-500/20 min-h-[calc(88vh)] border before:prose-code:content-["["] max-w-[calc(100vw-160px)] md:max-w-[45vw] after:prose-code:content-["]"] p-4 rounded'>
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

                    case '4/6':
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