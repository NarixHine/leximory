'use client'

import { Button, Card, CardBody, Spinner } from '@heroui/react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { QuizData } from '@repo/schema/paper'
import { streamAnsweraAction, streamVerdictAction } from '../actions'
import { Streamdown } from 'streamdown'
import { toast } from 'sonner'
import { ArrowClockwiseIcon, MicroscopeIcon } from '@phosphor-icons/react'
import { useRegisterRevise } from './atoms'
import { useProtectedButtonProps } from '@repo/ui/auth'
import { readStreamableValue } from '@repo/ui/utils'

const MotionCard = motion.create(Card)
const MotionCardBody = motion.create(CardBody)

export default function RevisePaper({ data }: { data: QuizData }) {
    const [expanded, setExpanded] = useState(false)
    const [answerText, setAnswerText] = useState('')
    const [verdictText, setVerdictText] = useState('')

    const { mutate: generateAnswer, isPending: isAnswerPending, isSuccess: isAnswerSuccess, reset } = useMutation({
        mutationFn: async () => {
            setExpanded(true)
            setAnswerText('')
            setVerdictText('')
            const textStream = await streamAnsweraAction(data)
            let answer = ''
            for await (const delta of readStreamableValue(textStream)) {
                answer += delta
                setAnswerText(answer)
            }
            if (answer) {
                generateVerdict(answer)
            }
            else {
                toast.error('AI 未能生成答案，请重试。')
                throw new Error('No answer generated')
            }
        },
        retry: 1
    })

    useRegisterRevise(generateAnswer)

    const { mutate: generateVerdict, isPending: isVerdictPending } = useMutation({
        mutationFn: async (answer: string) => {
            const textStream = await streamVerdictAction(data, answer)
            let verdict = ''
            for await (const delta of readStreamableValue(textStream)) {
                verdict += delta
                setVerdictText(verdict)
            }
        },
        retry: 1
    })

    const handlePress = () => {
        if (!expanded) {
            setExpanded(true)
            generateAnswer()
        }
    }

    const { isDisabled } = useProtectedButtonProps()

    return (
        <MotionCard isDisabled={isDisabled} transition={{ type: 'tween', duration: 0.3 }} isPressable={!expanded && !isDisabled} shadow='none' onPress={handlePress} data-expanded={expanded} className='bg-secondary-50 border-0 border-secondary-100 data-[expanded=true]:border-5 data-[expanded=true]:bg-transparent transition-all mt-3 mb-2 duration-300'>
            <MotionCardBody className={`p-4 duration-500`}>
                {!expanded && <p className='text-center'><MicroscopeIcon className='inline mr-1' weight='duotone' size={20} />AI 审题</p>}
                {expanded && (
                    <div className='flex flex-col gap-5 px-3 py-2'>
                        <div className='rounded-lg'>
                            <h3 className='text-secondary-400 text-sm flex items-center'>AI Answer <Button onPress={() => {
                                reset()
                                generateAnswer()
                            }} size='sm' variant='light' color='secondary' className='ml-1' startContent={<ArrowClockwiseIcon size={18} />} isIconOnly /></h3>
                            {answerText ? <Streamdown className='first:mt-0 last:mb-0'>{answerText}</Streamdown> : (isAnswerPending ? <div className='flex items-center'>作答中 <Spinner variant='dots' className='ml-1' /></div> : <div className='font-mono text-danger'>ERROR</div>)}
                        </div>
                        {isAnswerSuccess && !isAnswerPending && <div className='rounded-lg'>
                            <h3 className='text-secondary-400 text-sm'>AI Verdict</h3>
                            {verdictText ? <Streamdown className='first:mt-0 last:mb-0'>{verdictText}</Streamdown> : (isVerdictPending ? <div className='flex items-center mt-3'>评价中 <Spinner variant='dots' className='ml-1' /></div> : <div className='font-mono text-danger'>ERROR</div>)}
                        </div>}
                    </div>
                )}
            </MotionCardBody>
        </MotionCard>
    )
}