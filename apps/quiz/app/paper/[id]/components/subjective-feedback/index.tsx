'use client'

import { QuizItems, SectionAnswers, SubmissionFeedback, SummaryFeedback, TranslationFeedback, WritingFeedback, SUBJECTIVE_TYPES, SummaryData, TranslationData, WritingData } from '@repo/schema/paper'
import { Chip } from '@heroui/chip'
import { Popover, PopoverTrigger, PopoverContent } from '@heroui/react'
import { cn } from '@heroui/theme'
import { AppealButton } from './appeal'
import { CheckCircleIcon, XCircleIcon, WarningCircleIcon, ArrowFatLineRightIcon, SparkleIcon } from '@phosphor-icons/react'

/** Converts a constrained markdown string (bold, headers, paragraphs) to safe HTML. */
function mdToHtml(md: string): string {
    return md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/### (.+)/g, '<h3>$1</h3>')
        .replace(/## (.+)/g, '<h2>$1</h2>')
        .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br/>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>')
}

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
        <div className='flex flex-col gap-6 mt-8'>
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

/** Annotation type for marking up essay text with popover feedback. */
type Annotation = {
    start: number
    end: number
    kind: 'bad' | 'good'
    /** For 'bad': the improved version. For 'good': why it's good. */
    detail: string
}

/**
 * Matches badPairs/goodPairs originals against the answer text, producing
 * non-overlapping annotations sorted by position.
 */
function buildAnnotations(
    answer: string,
    badPairs: WritingFeedback['badPairs'],
    goodPairs: WritingFeedback['goodPairs'],
): Annotation[] {
    const annotations: Annotation[] = []
    const lowerAnswer = answer.toLowerCase()

    for (const pair of badPairs) {
        const needle = pair.original.toLowerCase()
        const idx = lowerAnswer.indexOf(needle)
        if (idx !== -1) {
            annotations.push({ start: idx, end: idx + pair.original.length, kind: 'bad', detail: pair.improved })
        }
    }
    for (const pair of goodPairs) {
        const needle = pair.original.toLowerCase()
        const idx = lowerAnswer.indexOf(needle)
        if (idx !== -1) {
            annotations.push({ start: idx, end: idx + pair.original.length, kind: 'good', detail: pair.why })
        }
    }

    // Sort by start position, remove overlaps (keep the first match)
    annotations.sort((a, b) => a.start - b.start)
    const merged: Annotation[] = []
    for (const ann of annotations) {
        const prev = merged[merged.length - 1]
        if (prev && ann.start < prev.end) continue // overlap — skip
        merged.push(ann)
    }
    return merged
}

/**
 * Renders the student's essay with inline popover annotations for good/bad pairs.
 * Unmatched pairs are shown in a fallback list below.
 */
function AnnotatedEssay({ answer, feedback }: { answer: string, feedback: WritingFeedback }) {
    const annotations = buildAnnotations(answer, feedback.badPairs, feedback.goodPairs)

    // Collect unmatched pairs (those that didn't find a position in the text)
    const matchedBadOriginals = new Set(annotations.filter(a => a.kind === 'bad').map(a => answer.slice(a.start, a.end).toLowerCase()))
    const matchedGoodOriginals = new Set(annotations.filter(a => a.kind === 'good').map(a => answer.slice(a.start, a.end).toLowerCase()))
    const unmatchedBad = feedback.badPairs.filter(p => !matchedBadOriginals.has(p.original.toLowerCase()))
    const unmatchedGood = feedback.goodPairs.filter(p => !matchedGoodOriginals.has(p.original.toLowerCase()))

    // Build segments: alternating plain text and annotated spans
    const segments: React.ReactNode[] = []
    let cursor = 0
    for (const ann of annotations) {
        if (ann.start > cursor) {
            segments.push(<span key={`t-${cursor}`}>{answer.slice(cursor, ann.start)}</span>)
        }
        const matchedText = answer.slice(ann.start, ann.end)
        segments.push(
            <Popover key={`a-${ann.start}`} shadow='sm'>
                <PopoverTrigger>
                    <span className={cn(
                        'cursor-pointer underline decoration-2 underline-offset-2 decoration-dotted',
                        ann.kind === 'bad' ? 'decoration-danger-400' : 'decoration-success-400',
                    )}>
                        {matchedText}
                    </span>
                </PopoverTrigger>
                <PopoverContent>
                    <div className='p-3 max-w-72 flex flex-col gap-1.5'>
                        {ann.kind === 'bad' ? (
                            <>
                                <p className='text-xs text-danger-600 flex items-center gap-1'>
                                    <XCircleIcon weight='fill' size={14} className='shrink-0' />
                                    有待改进
                                </p>
                                <p className='text-sm text-success-600 flex items-start gap-1.5'>
                                    <ArrowFatLineRightIcon weight='fill' size={14} className='shrink-0 mt-0.5' />
                                    {ann.detail}
                                </p>
                            </>
                        ) : (
                            <>
                                <p className='text-xs text-success-600 flex items-center gap-1'>
                                    <SparkleIcon weight='fill' size={14} className='shrink-0' />
                                    亮点
                                </p>
                                <p className='text-sm text-default-600'>{ann.detail}</p>
                            </>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        )
        cursor = ann.end
    }
    if (cursor < answer.length) {
        segments.push(<span key={`t-${cursor}`}>{answer.slice(cursor)}</span>)
    }

    return (
        <>
            <div className='font-mono text-sm leading-loose whitespace-pre-wrap'>
                {segments}
            </div>
            {unmatchedBad.length > 0 && (
                <div>
                    <p className='text-default-500 mb-2 font-medium text-xs uppercase tracking-wide'>有待改进</p>
                    <ul className='flex flex-col gap-3'>
                        {unmatchedBad.map((pair, i) => (
                            <li key={i} className='border-l-2 border-danger-300 pl-3'>
                                <p className='text-sm text-danger-600 line-through'>{pair.original}</p>
                                <p className='text-sm text-success-600 flex items-start gap-1.5 mt-1'>
                                    <ArrowFatLineRightIcon weight='fill' className='shrink-0 mt-0.5' size={14} />
                                    {pair.improved}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {unmatchedGood.length > 0 && (
                <div>
                    <p className='text-default-500 mb-2 font-medium text-xs uppercase tracking-wide'>亮点</p>
                    <ul className='flex flex-col gap-3'>
                        {unmatchedGood.map((pair, i) => (
                            <li key={i} className='border-l-2 border-success-300 pl-3'>
                                <p className='text-sm text-success-700 flex items-start gap-1.5'>
                                    <SparkleIcon weight='fill' className='shrink-0 mt-0.5' size={14} />
                                    {pair.original}
                                </p>
                                <p className='text-sm text-default-500 mt-1'>{pair.why}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </>
    )
}

function SummaryFeedbackCard({ data, answer, feedback }: { data: SummaryData, answer: string, feedback: SummaryFeedback }) {
    return (
        <section className='rounded-large bg-default-50 p-5 flex flex-col gap-4'>
            <div className='flex items-center justify-between'>
                <h2 className='font-bold text-lg'>Summary Writing</h2>
                <Chip color='primary' variant='flat' size='sm'>{feedback.totalScore}/10</Chip>
            </div>

            <div className='flex gap-4 text-sm text-default-600'>
                <span>内容：<strong className='text-foreground'>{feedback.contentScore}</strong>/5</span>
                <span>语言：<strong className='text-foreground'>{feedback.languageScore}</strong>/5</span>
            </div>

            <div className='text-sm text-default-500 italic leading-relaxed'>
                {highlightCopied(answer, feedback.copiedChunks)}
            </div>
            {feedback.copiedChunks.length > 0 && (
                <p className='text-sm text-warning-600 flex items-center gap-1.5'>
                    <WarningCircleIcon weight='fill' className='shrink-0' />
                    检测到直接照抄（{feedback.copiedChunks.length} 处）
                </p>
            )}

            <div>
                <p className='text-default-500 mb-2 font-medium text-xs uppercase tracking-wide'>核心要点</p>
                <ul className='list-none flex flex-col gap-1.5'>
                    {feedback.essentialItemResults.map((r, i) => (
                        <li key={i} className='flex items-start gap-2 text-sm'>
                            {r.fulfilled
                                ? <CheckCircleIcon weight='fill' className='text-success shrink-0 mt-0.5' size={16} />
                                : <XCircleIcon weight='fill' className='text-danger shrink-0 mt-0.5' size={16} />
                            }
                            <span>{r.item} <span className='text-default-400'>— {r.note}</span></span>
                        </li>
                    ))}
                </ul>
            </div>

            {feedback.extraItemResults.length > 0 && (
                <div>
                    <p className='text-default-500 mb-2 font-medium text-xs uppercase tracking-wide'>补充细节</p>
                    <ul className='list-none flex flex-col gap-1.5'>
                        {feedback.extraItemResults.map((r, i) => (
                            <li key={i} className='flex items-start gap-2 text-sm'>
                                {r.fulfilled
                                    ? <CheckCircleIcon weight='fill' className='text-success shrink-0 mt-0.5' size={16} />
                                    : <XCircleIcon weight='fill' className='text-danger shrink-0 mt-0.5' size={16} />
                                }
                                <span>{r.item} <span className='text-default-400'>— {r.note}</span></span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <p className='text-sm text-default-600 leading-relaxed'>{feedback.rationale}</p>
            <div>
                <AppealButton sectionId={data.id} sectionType='summary' feedback={feedback} />
            </div>
        </section>
    )
}

function TranslationFeedbackCard({ data, answers, feedback }: { data: TranslationData, answers: Record<number, string | null>, feedback: TranslationFeedback }) {
    return (
        <section className='rounded-large bg-default-50 p-5 flex flex-col gap-4'>
            <div className='flex items-center justify-between'>
                <h2 className='font-bold text-lg'>Translation</h2>
                <Chip color='primary' variant='flat' size='sm'>{feedback.totalScore}/{data.items.reduce((s, i) => s + i.score, 0)}</Chip>
            </div>

            <div className='flex flex-col gap-5'>
                {feedback.items.map((item, index) => (
                    <div key={index} className='flex flex-col gap-2'>
                        <div className='flex items-center justify-between'>
                            <span className='font-medium text-default-500'>#{index + 1}</span>
                            <Chip size='sm' variant='flat' color={item.score >= item.maxScore * 0.8 ? 'success' : item.score >= item.maxScore * 0.5 ? 'warning' : 'danger'}>
                                {item.score}/{item.maxScore}
                            </Chip>
                        </div>
                        <p className='text-sm text-default-500'>{data.items[index]?.chinese}</p>
                        <p className='text-sm italic'>{answers[index + 1] ?? <span className='text-default-400'>（未作答）</span>}</p>
                        <p className='text-sm text-default-600 leading-relaxed'>{item.rationale}</p>
                    </div>
                ))}
            </div>

            <div>
                <AppealButton sectionId={data.id} sectionType='translation' feedback={feedback} />
            </div>
        </section>
    )
}

function WritingFeedbackCard({ data, answer, feedback }: { data: WritingData, answer: string, feedback: WritingFeedback }) {
    return (
        <section className='rounded-large bg-default-50 p-5 flex flex-col gap-4'>
            <div className='flex items-center justify-between'>
                <h2 className='font-bold text-lg'>Guided Writing</h2>
                <Chip color='primary' variant='flat' size='sm'>{feedback.totalScore}/25</Chip>
            </div>

            <div className='flex gap-4 text-sm text-default-600 flex-wrap'>
                <span>内容：<strong className='text-foreground'>{feedback.contentScore}</strong>/10</span>
                <span>语言：<strong className='text-foreground'>{feedback.languageScore}</strong>/10</span>
                <span>结构：<strong className='text-foreground'>{feedback.structureScore}</strong>/5</span>
            </div>

            <p className='text-sm text-default-600 leading-relaxed'>{feedback.rationale}</p>

            {answer && <AnnotatedEssay answer={answer} feedback={feedback} />}

            {feedback.corrected && (
                <div>
                    <p className='text-default-500 mb-2 font-medium text-xs uppercase tracking-wide'>修改版本</p>
                    <div className='prose prose-sm dark:prose-invert max-w-none font-mono' dangerouslySetInnerHTML={{ __html: mdToHtml(feedback.corrected) }} />
                </div>
            )}

            <div>
                <AppealButton sectionId={data.id} sectionType='writing' feedback={feedback} />
            </div>
        </section>
    )
}
