import { ListeningQuestion, ReadingQuestion } from '@/components/editory/generators/types'
import { Button } from '@heroui/button'
import { Textarea, Input } from '@heroui/input'
import { toFilled } from 'es-toolkit'
import { PiCheckDuotone, PiPlusDuotone, PiTrashDuotone } from 'react-icons/pi'

export default function QnA<T extends ListeningQuestion | ReadingQuestion>({ questions, setQuestions, hasTranscript = false }: { questions: T[], setQuestions: (questions: T[]) => void, hasTranscript?: boolean }) {
    return <div className='flex flex-col gap-6'>
        {
            questions.map(({ q, a, correct }, index) => <div key={index} className='flex flex-col gap-2'>
                {'transcript' in questions[index] && <Textarea color='primary' description='Transcript' minRows={4} maxRows={20} value={questions[index].transcript} onValueChange={(value) => {
                    setQuestions(toFilled(questions, { ...questions[index], transcript: value }, index, index + 1))
                }} variant='flat' />}
                <div className='flex gap-2'>
                    <Button color='primary' variant='flat' isIconOnly radius='full' onPress={() => {
                        setQuestions(questions.toSpliced(index, 1))
                    }} startContent={<PiTrashDuotone />}></Button>
                    <Input color='primary' value={q} onValueChange={(q) => {
                        setQuestions(toFilled(questions, { ...questions[index], q }, index, index + 1))
                    }} variant='flat' />
                </div>
                <div className='flex flex-col gap-2'>
                    {a?.map((answer, index_) => <div key={index} className='flex gap-2'>
                        <Button color='success' size='sm' variant={index_ === correct ? 'flat' : 'light'} isIconOnly radius='full' onPress={() => {
                            setQuestions(toFilled(questions, { ...questions[index], correct: index_ }, index, index + 1))
                        }} startContent={<PiCheckDuotone />}></Button>
                        <Input color='primary' size='sm' value={answer} onValueChange={(value) => {
                            setQuestions(toFilled(questions, { ...questions[index], a: toFilled(a, value, index_, index_ + 1) }, index, index + 1))
                        }} variant='underlined' />
                    </div>)}
                </div>
            </div>)
        }
        <Button color='primary' variant='flat' fullWidth onPress={() => {
            setQuestions([...questions, { q: '', a: ['', '', '', ''], correct: 0, ...(hasTranscript ? { transcript: '' } : {}) } as T])
        }} startContent={<PiPlusDuotone />}>Add a question</Button>
    </div>
}
