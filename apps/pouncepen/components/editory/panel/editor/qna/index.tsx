import { ListeningQuestion, Question } from '@repo/schema/paper'
import { Button } from '@heroui/button'
import { Textarea, Input } from '@heroui/input'
import { toFilled } from 'es-toolkit'
import { CheckCircleIcon, PlusCircleIcon, TrashIcon } from '@phosphor-icons/react'

export default function QnA<T extends ListeningQuestion | Question>({ questions, setQuestions, hasTranscript = false }: { questions: T[], setQuestions: (questions: T[]) => void, hasTranscript?: boolean }) {
    return <div className='flex flex-col gap-6'>
        {
            questions.map(({ q, a, correct }, index) => <div key={index} className='flex flex-col gap-2'>
                {'transcript' in questions[index] && <Textarea color='secondary' description='Transcript' minRows={4} maxRows={20} value={questions[index].transcript} onValueChange={(value) => {
                    setQuestions(toFilled(questions, { ...questions[index], transcript: value }, index, index + 1))
                }} variant='bordered' />}
                <div className='flex gap-2'>
                    <Button color='danger' variant='light' size='sm' isIconOnly radius='full' onPress={() => {
                        setQuestions(questions.toSpliced(index, 1))
                    }} startContent={<TrashIcon />}></Button>
                    <Input color='secondary' size='sm' value={q} onValueChange={(q) => {
                        setQuestions(toFilled(questions, { ...questions[index], q }, index, index + 1))
                    }} variant='underlined' />
                </div>
                <div className='flex flex-col gap-2'>
                    {a?.map((answer: string, index_: number) => <div key={`${answer}${index_}`} className='flex gap-2'>
                        <Button color='success' size='sm' variant={index_ === correct ? 'flat' : 'light'} isIconOnly radius='full' onPress={() => {
                            setQuestions(toFilled(questions, { ...questions[index], correct: index_ }, index, index + 1))
                        }} startContent={<CheckCircleIcon />}></Button>
                        <Input color='success' size='sm' value={answer} onValueChange={(value) => {
                            setQuestions(toFilled(questions, { ...questions[index], a: toFilled(a, value, index_, index_ + 1) }, index, index + 1))
                        }} variant='underlined' />
                    </div>)}
                </div>
            </div>)
        }
        <Button color='secondary' variant='flat' fullWidth onPress={() => {
            setQuestions([...questions, { q: '', a: ['', '', '', ''], correct: 0, ...(hasTranscript ? { transcript: '' } : {}) } as T])
    }} startContent={<PlusCircleIcon />}>添加问题</Button>
    </div>
}

