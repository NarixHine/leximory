import { Card, CardBody } from '@heroui/card'
import { cn } from '@heroui/theme'
import { CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react/ssr'
import { parseQuestionNoteContent, QuestionNoteContent } from '@repo/supabase/question-note'

export interface QuestionNoteCardProps {
    content: string
    className?: string
    cardBodyClassName?: string
}

export function QuestionNoteCard({ content, className, cardBodyClassName }: QuestionNoteCardProps) {
    const parsed = parseQuestionNoteContent(content)
    
    if (!parsed) {
        return (
            <Card fullWidth radius='sm' shadow='none' className={className}>
                <CardBody className={cn('px-5 py-3 leading-snug gap-2', cardBodyClassName)}>
                    <div className='text-default-400'>无法解析笔记内容</div>
                </CardBody>
            </Card>
        )
    }
    
    const { sentence, correctAnswer, wrongAnswer, keyPoints } = parsed
    const hasWrongAnswer = wrongAnswer && wrongAnswer.length > 0
    
    return (
        <Card fullWidth radius='sm' shadow='none' className={className}>
            <CardBody className={cn('px-5 py-3 leading-snug gap-3', cardBodyClassName)}>
                {/* Sentence with blank */}
                <div className='text-base leading-relaxed font-serif'>
                    {sentence}
                </div>
                
                {/* Answers section */}
                <div className='flex flex-col gap-1.5'>
                    {hasWrongAnswer && (
                        <div className='flex items-center gap-2 text-sm'>
                            <XCircleIcon weight='fill' className='text-danger shrink-0' />
                            <span className='text-danger line-through'>{wrongAnswer}</span>
                        </div>
                    )}
                    <div className='flex items-center gap-2 text-sm'>
                        <CheckCircleIcon weight='fill' className='text-success shrink-0' />
                        <span className='text-success font-medium'>{correctAnswer}</span>
                    </div>
                </div>
                
                {/* Key points */}
                <div className='border-l-2 border-primary pl-3 text-sm text-default-600'>
                    {keyPoints}
                </div>
            </CardBody>
        </Card>
    )
}
