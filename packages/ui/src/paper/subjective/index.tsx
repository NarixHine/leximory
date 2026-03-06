'use client'

import { useAtomValue, useSetAtom } from 'jotai'
import { answersAtom, feedbackAtom, setAnswerAtom, viewModeAtom, submittedAnswersAtom } from '../atoms'
import { Textarea, Popover, PopoverTrigger, PopoverContent } from '@heroui/react'
import { useMemo, useCallback, useRef, useState, useEffect } from 'react'
import { cn } from '@heroui/theme'
import type { SummaryFeedback, TranslationFeedback, WritingFeedback } from '@repo/schema/paper'
import { CheckCircleIcon, XCircleIcon, WarningCircleIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { AppealButton } from './appeal'

/** Counts words in a string (whitespace-separated tokens). */
function countWords(text: string): number {
    const trimmed = text.trim()
    if (!trimmed) return 0
    return trimmed.split(/\s+/).length
}

/**
 * A text area input for subjective question types (summary, translation, writing).
 * In normal mode, it provides an editable text area.
 * In revise mode, it displays the submitted answer with inline feedback.
 */
export function SubjectiveInput({ groupId, localNo, placeholder, maxLength, variant = 'default' }: {
    groupId: string
    localNo: number
    placeholder?: string
    maxLength?: number
    variant?: 'default' | 'summary' | 'translation' | 'writing'
}) {
    const viewMode = useAtomValue(viewModeAtom)
    const answers = useAtomValue(answersAtom)
    const submittedAnswers = useAtomValue(submittedAnswersAtom)
    const feedback = useAtomValue(feedbackAtom)
    const setAnswer = useSetAtom(setAnswerAtom)

    const isRevise = viewMode === 'revise'
    const currentAnswer = isRevise
        ? submittedAnswers[groupId]?.[localNo] ?? ''
        : answers[groupId]?.[localNo] ?? ''

    const sectionFeedback = feedback?.[groupId] ?? null

    if (isRevise) {
        if (variant === 'summary' && sectionFeedback?.type === 'summary') {
            return <SummaryReviseFeedback answer={currentAnswer} feedback={sectionFeedback} />
        }
        if (variant === 'translation' && sectionFeedback?.type === 'translation') {
            const itemFeedback = sectionFeedback.items[localNo - 1]
            return <TranslationItemReviseFeedback answer={currentAnswer} itemFeedback={itemFeedback} />
        }
        if (variant === 'writing' && sectionFeedback?.type === 'writing') {
            return <WritingReviseFeedback answer={currentAnswer} feedback={sectionFeedback} />
        }
        // Default revise mode (no feedback yet)
        return (
            <div className='mt-3 p-4 bg-default-50 rounded-large text-sm whitespace-pre-wrap min-h-20'>
                {currentAnswer || <span className='text-default-400 italic'>（未作答）</span>}
            </div>
        )
    }

    if (variant === 'summary') {
        return <SummaryInputWithRing groupId={groupId} localNo={localNo} currentAnswer={currentAnswer} setAnswer={setAnswer} />
    }

    return (
        <Textarea
            value={currentAnswer}
            onValueChange={(value) => setAnswer({ sectionId: groupId, localQuestionNo: localNo, option: value })}
            placeholder={placeholder}
            variant='underlined'
            minRows={variant === 'writing' ? 10 : 1}
            maxRows={variant === 'writing' ? 20 : 3}
            maxLength={maxLength}
            className='mt-2'
            classNames={{
                input: 'text-sm',
            }}
        />
    )
}

// ─── Summary Feedback ──────────────────────────────────────────────────

function SummaryReviseFeedback({ answer, feedback }: { answer: string, feedback: SummaryFeedback }) {
    return (
        <div className='mt-4 flex flex-col gap-4'>
            <div className='flex items-baseline'>
                <span className='text-2xl font-bold font-mono'>{feedback.totalScore}</span>
                <span className='text-default-400 font-mono'>/10</span>
                <span className='text-sm text-default-500 ml-2 space-x-3'>
                    <span>内容 <span className='font-mono'>{feedback.contentScore}/5</span></span>
                    <span>语言 <span className='font-mono'>{feedback.languageScore}/5</span></span>
                </span>
            </div>

            <div className='font-mono text-sm leading-loose whitespace-pre-wrap p-4 bg-default-50 rounded-large'>
                {feedback.copiedChunks.length > 0
                    ? <HighlightCopied answer={answer} copiedChunks={feedback.copiedChunks} />
                    : (answer || <span className='text-default-400 italic'>（未作答）</span>)
                }
            </div>
            {feedback.copiedChunks.length > 0 && (
                <p className='text-sm text-warning-600 flex items-center gap-1.5'>
                    <WarningCircleIcon className='shrink-0' size={16} />
                    检测到直接照抄（{feedback.copiedChunks.length} 处）
                </p>
            )}

            <div className='flex flex-col -mt-3'>
                <p className='text-sm text-default-600 font-medium'>基本点</p>
                <ul className='list-none flex flex-col gap-1.5'>
                    {feedback.essentialItemResults.map((r, i) => (
                        <li key={i} className='flex items-start gap-2 text-sm'>
                            {r.fulfilled
                                ? <CheckCircleIcon className='text-success shrink-0 mt-0.5' size={16} />
                                : <XCircleIcon className='text-default-400 shrink-0 mt-0.5' size={16} />
                            }
                            <span>{r.item}{r.note && <span className='text-default-400'> — {r.note}</span>}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {feedback.extraItemResults.length > 0 && (
                <div className='flex flex-col -mt-3'>
                    <p className='text-sm text-default-600 font-medium'>附加点</p>
                    <ul className='list-none flex flex-col gap-1.5'>
                        {feedback.extraItemResults.map((r, i) => (
                            <li key={i} className='flex items-start gap-2 text-sm'>
                                {r.fulfilled
                                    ? <CheckCircleIcon className='text-success shrink-0 mt-0.5' size={16} />
                                    : <XCircleIcon className='text-default-400 shrink-0 mt-0.5' size={16} />
                                }
                                <span>{r.item}{r.note && <span className='text-default-400'> — {r.note}</span>}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <p className='text-sm text-default-600 leading-relaxed'>{feedback.rationale}</p>
        </div>
    )
}

/** Highlights copied chunks in the student's answer text. */
function HighlightCopied({ answer, copiedChunks }: { answer: string, copiedChunks: string[] }) {
    if (copiedChunks.length === 0) return <>{answer}</>

    const escaped = copiedChunks.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
    const parts = answer.split(regex)

    return (
        <span>
            {parts.map((part, i) => {
                const isHighlighted = copiedChunks.some(c => c.toLowerCase() === part.toLowerCase())
                return isHighlighted
                    ? <mark key={i} className='bg-warning-100 dark:bg-warning-100 text-inherit rounded px-0.5'>{part}</mark>
                    : <span key={i}>{part}</span>
            })}
        </span>
    )
}

// ─── Translation Feedback ──────────────────────────────────────────────

function TranslationItemReviseFeedback({ answer, itemFeedback }: {
    answer: string
    itemFeedback?: TranslationFeedback['items'][number]
}) {
    if (!itemFeedback) {
        return (
            <div className='mt-2 p-3 bg-default-50 rounded-large text-sm whitespace-pre-wrap'>
                {answer || <span className='text-default-400 italic'>（未作答）</span>}
            </div>
        )
    }

    const annotations = buildAnnotations(answer, itemFeedback.badPairs, [])

    const segments: React.ReactNode[] = []
    let cursor = 0
    for (const ann of annotations) {
        if (ann.start > cursor) {
            segments.push(<span key={`t-${cursor}`}>{answer.slice(cursor, ann.start)}</span>)
        }
        const matchedText = answer.slice(ann.start, ann.end)
        segments.push(
            <AnnotationPopover key={`a-${ann.start}`} annotation={ann} matchedText={matchedText} />
        )
        cursor = ann.end
    }
    if (cursor < answer.length) {
        segments.push(<span key={`t-${cursor}`}>{answer.slice(cursor)}</span>)
    }

    return (
        <div className='mt-2 flex flex-col gap-2'>
            <div className='font-mono text-sm leading-relaxed p-3 bg-default-50 rounded-large whitespace-pre-wrap'>
                {answer
                    ? (annotations.length > 0 ? segments : answer)
                    : <span className='text-default-400 italic'>（未作答）</span>
                }
            </div>
            <div className='flex items-baseline'>
                <span className='text-lg font-bold font-mono'>{itemFeedback.score}</span>
                <span className='text-default-400 text-sm font-mono'>/{itemFeedback.maxScore}</span>
            </div>
            {itemFeedback.rationale && (
                <p className='text-sm text-default-600 leading-relaxed'>{itemFeedback.rationale}</p>
            )}
        </div>
    )
}

// ─── Writing Feedback ──────────────────────────────────────────────────

/** Converts constrained markdown to safe HTML. */
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

type Annotation = {
    start: number
    end: number
    kind: 'bad' | 'good'
    detail: string
}

function buildAnnotations(
    answer: string,
    badPairs: { original: string, improved: string }[],
    goodPairs: { original: string, why: string }[],
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

    annotations.sort((a, b) => a.start - b.start)
    const merged: Annotation[] = []
    for (const ann of annotations) {
        const prev = merged[merged.length - 1]
        if (prev && ann.start < prev.end) continue
        merged.push(ann)
    }
    return merged
}

/** Reusable popover for an annotation on student text. */
function AnnotationPopover({ annotation, matchedText }: { annotation: Annotation, matchedText: string }) {
    return (
        <Popover shadow='sm'>
            <PopoverTrigger>
                <span className={cn(
                    'cursor-pointer underline decoration-2 underline-offset-2 decoration-dotted',
                    annotation.kind === 'bad' ? 'decoration-danger-400' : 'decoration-success-400',
                )}>
                    {matchedText}
                </span>
            </PopoverTrigger>
            <PopoverContent>
                <div className='p-3 max-w-72 flex flex-col gap-1.5'>
                    {annotation.kind === 'bad' ? (
                        <>
                            <p className='text-xs text-default-500'>有待改进</p>
                            <p className='text-sm flex items-start gap-1.5'>
                                <ArrowRightIcon className='shrink-0 mt-0.5' size={14} />
                                {annotation.detail}
                            </p>
                        </>
                    ) : (
                        <>
                            <p className='text-xs text-default-500'>亮点</p>
                            <p className='text-sm'>{annotation.detail}</p>
                        </>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

function WritingReviseFeedback({ answer, feedback }: { answer: string, feedback: WritingFeedback }) {
    const annotations = buildAnnotations(answer, feedback.badPairs, feedback.goodPairs)

    const segments: React.ReactNode[] = []
    let cursor = 0
    for (const ann of annotations) {
        if (ann.start > cursor) {
            segments.push(<span key={`t-${cursor}`}>{answer.slice(cursor, ann.start)}</span>)
        }
        const matchedText = answer.slice(ann.start, ann.end)
        segments.push(
            <AnnotationPopover key={`a-${ann.start}`} annotation={ann} matchedText={matchedText} />
        )
        cursor = ann.end
    }
    if (cursor < answer.length) {
        segments.push(<span key={`t-${cursor}`}>{answer.slice(cursor)}</span>)
    }

    return (
        <div className='mt-6 flex flex-col gap-4'>
            <div className='flex items-baseline'>
                <span className='text-2xl font-bold font-mono'>{feedback.totalScore}</span>
                <span className='text-default-400 font-mono'>/25</span>
                <span className='text-sm text-default-500 ml-2 space-x-3'>
                    <span>内容 <span className='font-mono'>{feedback.contentScore}/10</span></span>
                    <span>语言 <span className='font-mono'>{feedback.languageScore}/10</span></span>
                    <span>结构 <span className='font-mono'>{feedback.structureScore}/5</span></span>
                </span>
            </div>

            <p className='text-sm text-default-600 leading-relaxed'>{feedback.rationale}</p>

            {
                answer ? (
                    <div className='font-mono text-sm leading-loose whitespace-pre-wrap p-4 bg-default-50 rounded-large'>
                        {segments}
                    </div>
                ) : (
                    <div className='p-4 bg-default-50 rounded-large text-sm'>
                        <span className='text-default-400 italic'>（未作答）</span>
                    </div>
                )
            }

            {
                feedback.corrected && (
                    <div className='flex flex-col'>
                        <p className='text-sm text-default-500 font-medium'>修改版本</p>
                        <div className='prose prose-sm dark:prose-invert max-w-none font-mono' dangerouslySetInnerHTML={{ __html: mdToHtml(feedback.corrected) }} />
                    </div>
                )
            }
        </div >
    )
}

// ─── Summary Input Ring ────────────────────────────────────────────────

function SummaryInputWithRing({ groupId, localNo, currentAnswer, setAnswer }: {
    groupId: string
    localNo: number
    currentAnswer: string
    setAnswer: (payload: { sectionId: string; localQuestionNo: number; option: string }) => void
}) {
    const wordCount = useMemo(() => countWords(currentAnswer), [currentAnswer])
    const wrapperRef = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState({ w: 0, h: 0 })

    useEffect(() => {
        const el = wrapperRef.current
        if (!el) return
        const ro = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (!entry) return
            const { width, height } = entry.contentRect
            setSize({ w: width, h: height })
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const progress = Math.min(wordCount / 60, 1)
    const ringColor = wordCount >= 60 ? '#ef4444' : wordCount >= 50 ? '#eab308' : '#22c55e'
    const pathLen = 1000
    const dashOffset = pathLen * (1 - progress)
    const rw = size.w - 2
    const rh = size.h - 5
    const rx = 11

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setAnswer({ sectionId: groupId, localQuestionNo: localNo, option: e.target.value })
        const el = e.target
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
    }, [setAnswer, groupId, localNo])

    return (
        <div className='mt-3 flex flex-col gap-1'>
            <div ref={wrapperRef} className='relative'>
                {size.w > 0 && size.h > 0 && (
                    <svg
                        className='absolute inset-0 w-full h-full pointer-events-none z-10'
                        viewBox={`0 0 ${size.w} ${size.h}`}
                        fill='none'
                    >
                        <rect
                            x={1} y={1}
                            width={rw} height={rh}
                            rx={rx} ry={rx}
                            stroke={ringColor}
                            strokeWidth={2}
                            pathLength={pathLen}
                            strokeDasharray={pathLen}
                            strokeDashoffset={dashOffset}
                            strokeLinecap='round'
                            style={{
                                transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease',
                            }}
                        />
                    </svg>
                )}
                <textarea
                    value={currentAnswer}
                    onChange={handleChange}
                    rows={3}
                    aria-label='Summary'
                    className='w-full resize-none rounded-medium border border-default-200 bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-default-400 outline-none transition-colors focus:border-default-400'
                />
            </div>
            <div className='flex justify-end pr-1'>
                <span className={`text-xs font-mono ${wordCount >= 60 ? 'text-danger font-medium' : wordCount >= 50 ? 'text-warning font-medium' : 'text-default-400'}`}>
                    {wordCount} / 60
                </span>
            </div>
        </div>
    )
}

// ─── Section Appeal Footer ─────────────────────────────────────────────

/**
 * Renders the appeal button for a subjective section.
 * Place this at the end of each subjective section's renderPaper to show
 * the appeal button within its natural context.
 */
export function SubjectiveSectionFooter({ groupId }: { groupId: string }) {
    const viewMode = useAtomValue(viewModeAtom)
    const feedback = useAtomValue(feedbackAtom)

    if (viewMode !== 'revise') return null

    const sectionFeedback = feedback?.[groupId]
    if (!sectionFeedback) return null

    return (
        <div className='mt-0 mb-8'>
            <AppealButton sectionId={groupId} sectionType={sectionFeedback.type} feedback={sectionFeedback} />
        </div>
    )
}
