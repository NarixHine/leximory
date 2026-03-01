'use client'

import { QuizItems, SectionAnswers, SubmissionFeedback, SummaryFeedback, TranslationFeedback, WritingFeedback, SUBJECTIVE_TYPES, SummaryData, TranslationData, WritingData } from '@repo/schema/paper'
import { Chip } from '@heroui/chip'
import { Divider } from '@heroui/divider'
import { cn } from '@heroui/theme'
import { AppealButton } from './appeal'

/**
 * Panel that displays AI marking feedback for all subjective sections.
 */
export function SubjectiveFeedbackPanel({ quizData, answers, feedback }: {
    quizData: QuizItems
    answers: SectionAnswers
    feedback: SubmissionFeedback
}) {
    const subjectiveSections = quizData.filter(
        (section) => (SUBJECTIVE_TYPES as readonly string[]).includes(section.type)
    )

    if (subjectiveSections.length === 0) return null

    return (
        <div className='flex flex-col gap-6 mt-6'>
            <h3 className='text-lg font-bold'>主观题批改结果</h3>
            {subjectiveSections.map((section) => {
                const sectionFeedback = feedback[section.id]
                if (!sectionFeedback) return null

                switch (sectionFeedback.type) {
                    case 'summary':
                        return <SummaryFeedbackCard key={section.id} data={section as SummaryData} answer={answers[section.id]?.[1] ?? ''} feedback={sectionFeedback} />
                    case 'translation':
                        return <TranslationFeedbackCard key={section.id} data={section as TranslationData} answers={answers[section.id] ?? {}} feedback={sectionFeedback} />
                    case 'writing':
                        return <WritingFeedbackCard key={section.id} data={section as WritingData} answer={answers[section.id]?.[1] ?? ''} feedback={sectionFeedback} />
                    default:
                        return null
                }
            })}
        </div>
    )
}

/** Highlights copied chunks in the student's answer text using React elements. */
function highlightCopied(answer: string, copiedChunks: string[]): React.ReactNode {
    if (copiedChunks.length === 0) return answer

    // Build a regex matching all chunks (case-insensitive)
    const escaped = copiedChunks.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
    const parts = answer.split(regex)

    return (
        <span>
            {parts.map((part, i) => {
                const isHighlighted = copiedChunks.some(c => c.toLowerCase() === part.toLowerCase())
                return isHighlighted
                    ? <mark key={i} className='bg-warning-200 rounded px-0.5'>{part}</mark>
                    : <span key={i}>{part}</span>
            })}
        </span>
    )
}

function SummaryFeedbackCard({ data, answer, feedback }: { data: SummaryData, answer: string, feedback: SummaryFeedback }) {
    return (
        <div className='border border-default-200 rounded-medium p-4 flex flex-col gap-3'>
            <div className='flex items-center justify-between'>
                <h4 className='font-bold'>Summary Writing</h4>
                <Chip color='primary' variant='flat' size='sm'>{feedback.totalScore}/10</Chip>
            </div>
            <div className='flex gap-4 text-sm'>
                <span>内容：<strong>{feedback.contentScore}</strong>/5</span>
                <span>语言：<strong>{feedback.languageScore}</strong>/5</span>
            </div>
            <Divider />
            <div className='text-sm'>
                <p className='italic'>{highlightCopied(answer, feedback.copiedChunks)}</p>
            </div>
            {feedback.copiedChunks.length > 0 && (
                <p className='text-xs text-warning-600'>⚠ 检测到直接照抄（{feedback.copiedChunks.length} 处）</p>
            )}
            <div className='text-sm'>
                <p className='text-default-500 mb-1'>核心要点：</p>
                <ul className='list-none flex flex-col gap-1'>
                    {feedback.essentialItemResults.map((r, i) => (
                        <li key={i} className='flex items-start gap-1'>
                            <span className={cn('shrink-0', r.fulfilled ? 'text-success' : 'text-danger')}>{r.fulfilled ? '✓' : '✗'}</span>
                            <span>{r.item} <span className='text-default-400'>— {r.note}</span></span>
                        </li>
                    ))}
                </ul>
            </div>
            {feedback.extraItemResults.length > 0 && (
                <div className='text-sm'>
                    <p className='text-default-500 mb-1'>补充细节：</p>
                    <ul className='list-none flex flex-col gap-1'>
                        {feedback.extraItemResults.map((r, i) => (
                            <li key={i} className='flex items-start gap-1'>
                                <span className={cn('shrink-0', r.fulfilled ? 'text-success' : 'text-danger')}>{r.fulfilled ? '✓' : '✗'}</span>
                                <span>{r.item} <span className='text-default-400'>— {r.note}</span></span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <p className='text-sm text-default-600'>{feedback.rationale}</p>
            <AppealButton sectionId={data.id} sectionType='summary' feedback={feedback} />
        </div>
    )
}

function TranslationFeedbackCard({ data, answers, feedback }: { data: TranslationData, answers: Record<number, string | null>, feedback: TranslationFeedback }) {
    return (
        <div className='border border-default-200 rounded-medium p-4 flex flex-col gap-3'>
            <div className='flex items-center justify-between'>
                <h4 className='font-bold'>Translation</h4>
                <Chip color='primary' variant='flat' size='sm'>{feedback.totalScore}/{data.items.reduce((s, i) => s + i.score, 0)}</Chip>
            </div>
            <Divider />
            {feedback.items.map((item, index) => (
                <div key={index} className='text-sm flex flex-col gap-1'>
                    <div className='flex items-center justify-between'>
                        <span className='font-medium'>#{index + 1}</span>
                        <Chip size='sm' variant='flat' color={item.score >= item.maxScore * 0.8 ? 'success' : item.score >= item.maxScore * 0.5 ? 'warning' : 'danger'}>
                            {item.score}/{item.maxScore}
                        </Chip>
                    </div>
                    <p className='text-default-500'>{data.items[index]?.chinese}</p>
                    <p className='italic'>{answers[index + 1] ?? <span className='text-default-400'>（未作答）</span>}</p>
                    <p className='text-default-600'>{item.rationale}</p>
                </div>
            ))}
            <AppealButton sectionId={data.id} sectionType='translation' feedback={feedback} />
        </div>
    )
}

function WritingFeedbackCard({ data, answer, feedback }: { data: WritingData, answer: string, feedback: WritingFeedback }) {
    return (
        <div className='border border-default-200 rounded-medium p-4 flex flex-col gap-3'>
            <div className='flex items-center justify-between'>
                <h4 className='font-bold'>Guided Writing</h4>
                <Chip color='primary' variant='flat' size='sm'>{feedback.totalScore}/25</Chip>
            </div>
            <div className='flex gap-4 text-sm flex-wrap'>
                <span>内容：<strong>{feedback.contentScore}</strong>/10</span>
                <span>语言：<strong>{feedback.languageScore}</strong>/10</span>
                <span>结构：<strong>{feedback.structureScore}</strong>/5</span>
            </div>
            <Divider />
            <p className='text-sm text-default-600'>{feedback.rationale}</p>
            {feedback.badPairs.length > 0 && (
                <div className='text-sm'>
                    <p className='text-default-500 mb-1 font-medium'>有待改进：</p>
                    <ul className='flex flex-col gap-2'>
                        {feedback.badPairs.map((pair, i) => (
                            <li key={i} className='border-l-2 border-danger-300 pl-2'>
                                <p className='text-danger-600 line-through'>{pair.original}</p>
                                <p className='text-success-600'>{pair.improved}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {feedback.goodPairs.length > 0 && (
                <div className='text-sm'>
                    <p className='text-default-500 mb-1 font-medium'>亮点：</p>
                    <ul className='flex flex-col gap-2'>
                        {feedback.goodPairs.map((pair, i) => (
                            <li key={i} className='border-l-2 border-success-300 pl-2'>
                                <p className='text-success-700'>{pair.original}</p>
                                <p className='text-default-500'>{pair.why}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {feedback.corrected && (
                <div className='text-sm'>
                    <Divider className='my-2' />
                    <p className='text-default-500 mb-1 font-medium'>修改版本：</p>
                    <div className='prose prose-sm dark:prose-invert max-w-none' dangerouslySetInnerHTML={{ __html: feedback.corrected.replace(/\n/g, '<br/>') }} />
                </div>
            )}
            <AppealButton sectionId={data.id} sectionType='writing' feedback={feedback} />
        </div>
    )
}
