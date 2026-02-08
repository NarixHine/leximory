import { View, Text } from 'react-native'
import fastShuffle from 'fast-shuffle'
import { nanoid } from 'nanoid'
import { MultipleChoice, FillInTheBlank } from '../components/blank'
import Choice from '../components/choice'
import { createQuestionStrategy, OptionsTable, SectionTitle } from './utils'
import { extractCodeContent, getSeed } from '../../shared/utils'
import { replaceBlanks, extractBlanks } from '../utils/html'
import { ALPHABET_SET } from '../config'
import {
    GrammarData,
    ReadingData,
    ListeningData,
    ClozeData,
    FishingData,
    SentenceChoiceData,
    CustomData,
    QuestionStrategy,
    QuizData
} from '@repo/schema/paper'

/**
 * Listening strategy for React Native
 */
const listeningStrategy: QuestionStrategy<ListeningData> = createQuestionStrategy<ListeningData>({
    keyPerLine: 5,
    getQuestionCount: (data) => data.questions.length,
    getCorrectAnswers: (data) => data.questions.map(q => q.a[q.correct]),
    renderRubric: () => <SectionTitle>Listening</SectionTitle>,
    renderPaper: ({ data, config }) => (
        <View className='mb-4'>
            {data.questions.map((q, index) => {
                const displayNo = (config.start ?? 1) + index
                return (
                    <View key={index} className='flex-row gap-2 mb-3'>
                        <Text className='font-bold'>{displayNo}.</Text>
                        <View className='flex-1'>
                            <View className='flex-row flex-wrap'>
                                {q.a.map((option, i) => (
                                    <Text key={i} className='w-1/2 mb-1 text-sm'>
                                        {ALPHABET_SET[i]}. {option}
                                    </Text>
                                ))}
                            </View>
                        </View>
                    </View>
                )
            })}
        </View>
    ),
    renderAnswerSheet: ({ data, config, quizData }) => (
        <View className='mb-4'>
            {data.questions.map((q, index) => {
                const displayNo = (config.start ?? 1) + index
                const localNo = index + 1
                return (
                    <View key={index} className='flex-row gap-2 mb-3'>
                        <Text className='font-bold'>{displayNo}.</Text>
                        <MultipleChoice
                            displayNo={displayNo}
                            localNo={localNo}
                            options={q.a}
                            groupId={data.id}
                            quizData={quizData}
                        />
                    </View>
                )
            })}
        </View>
    ),
    getDefaultValue: () => ({
        id: nanoid(8),
        questions: [{
            transcript: 'W: Aren't you cold? Why aren't you wearing a coat?\nM: I overslept this morning, so I ran out of the house without listening to the forecast.',
            q: 'What does the man mean?',
            a: ['He didn't know it would be cold.', 'He misunderstood the weather report.', 'He didn't have time to look for the coat.', 'He forgot to bring the coat.'],
            correct: 0,
        }],
        type: 'listening',
    }),
})

/**
 * Grammar strategy for React Native
 */
const grammarStrategy: QuestionStrategy<GrammarData> = createQuestionStrategy<GrammarData>({
    keyPerLine: 5,
    getQuestionCount: (data) => extractCodeContent(data.text).length,
    isCorrect: (userAnswer, correctAnswer) => correctAnswer.split('/').map(s => s.trim()).includes(userAnswer),
    renderRubric: () => <SectionTitle>Grammar</SectionTitle>,
    renderPaper: ({ data, config, quizData }) => {
        const parsedContent = replaceBlanks(data.text, config.start ?? 1, (displayNo, localNo, originalContent) => {
            const hint = data.hints[originalContent]
            const blankCount = hint ? 1 : originalContent.split('/')[0].split(' ').length
            return (
                <View className='inline-flex flex-row items-center'>
                    <FillInTheBlank
                        blankCount={blankCount}
                        displayNo={displayNo}
                        localNo={localNo}
                        groupId={data.id}
                        quizData={quizData}
                    />
                    {hint && <Text className='text-gray-500 ml-1'>({hint})</Text>}
                </View>
            )
        })
        return <View className='mb-4'>{parsedContent}</View>
    },
    renderAnswerSheet: ({ data, config, quizData }) => {
        const blanks = extractBlanks(data.text, config.start ?? 1, (displayNo, localNo) => {
            return (
                <FillInTheBlank
                    key={displayNo}
                    displayNo={displayNo}
                    localNo={localNo}
                    groupId={data.id}
                    quizData={quizData}
                />
            )
        })
        return <View className='flex flex-col gap-2 mb-4'>{blanks}</View>
    },
    getDefaultValue: () => ({
        id: nanoid(8),
        text: '<p>The quick brown fox <code>jumps</code> over the lazy dog.</p>',
        type: 'grammar',
        hints: {}
    }),
})

/**
 * Fishing (vocabulary) strategy for React Native
 */
const fishingStrategy: QuestionStrategy<FishingData, string[]> = createQuestionStrategy<FishingData, string[]>({
    keyPerLine: 5,
    renderRubric: () => <SectionTitle>Vocabulary</SectionTitle>,
    getOptions: (data) => {
        const correct = extractCodeContent(data.text)
        const allOptions = [...correct, ...data.distractors]
        return fastShuffle(getSeed(allOptions.join('')) * 1000, allOptions)
    },
    getQuestionCount: (data) => extractCodeContent(data.text).length,
    renderPaper: ({ data, config, options, quizData }) => {
        const parsedContent = replaceBlanks(data.text, config.start ?? 1, (displayNo, localNo) => {
            return (
                <MultipleChoice
                    displayNo={displayNo}
                    localNo={localNo}
                    options={options}
                    groupId={data.id}
                    quizData={quizData}
                />
            )
        })
        return (
            <View className='mb-4'>
                <OptionsTable options={options!.map((opt, idx) => `${ALPHABET_SET[idx]}. ${opt}`)} perRow={3} />
                {parsedContent}
            </View>
        )
    },
    renderAnswerSheet: ({ data, config, options, quizData }) => {
        const blanks = extractBlanks(data.text, config.start ?? 1, (displayNo, localNo) => {
            return (
                <MultipleChoice
                    key={displayNo}
                    displayNo={displayNo}
                    localNo={localNo}
                    options={options}
                    groupId={data.id}
                    quizData={quizData}
                />
            )
        })
        return <View className='flex flex-col gap-2 mb-4'>{blanks}</View>
    },
    getDefaultValue: () => ({
        id: nanoid(8),
        text: '<p>The word <code>example</code> is used here.</p>',
        type: 'fishing',
        distractors: ['sample', 'instance'],
        markerSet: ALPHABET_SET
    }),
})

/**
 * Cloze strategy for React Native
 */
const clozeStrategy: QuestionStrategy<ClozeData, Record<string, string[]>> = createQuestionStrategy<ClozeData, Record<string, string[]>>({
    keyPerLine: 5,
    renderRubric: () => <SectionTitle>Cloze</SectionTitle>,
    getQuestionCount: (data) => extractCodeContent(data.text).length,
    getOptions: (data) => {
        return data.questions.reduce((acc, q) => {
            const choices = [q.original, ...(q.distractors ?? [])]
            acc[q.original] = fastShuffle(getSeed(choices.join('')) * 1000, choices)
            return acc
        }, {} as { [key: string]: string[] })
    },
    getCorrectAnswers: (data) => extractCodeContent(data.text),
    renderPaper: ({ data, config, options: shuffledOptionsMap, quizData }) => {
        const parsedContent = replaceBlanks(data.text, config.start ?? 1, (displayNo, localNo, originalContent) => {
            return (
                <MultipleChoice
                    displayNo={displayNo}
                    localNo={localNo}
                    options={shuffledOptionsMap![originalContent]}
                    groupId={data.id}
                    quizData={quizData}
                />
            )
        })
        return (
            <View className='mb-4'>
                {parsedContent}
                <View className='mt-4 p-3 bg-gray-50 rounded-lg'>
                    <Text className='font-bold mb-2'>Options:</Text>
                    {data.questions.map((q, index) => {
                        const questionNumber = (config.start ?? 1) + index
                        const options = shuffledOptionsMap![q.original] || []
                        return (
                            <View key={index} className='mb-2'>
                                <Text className='font-semibold'>{questionNumber}.</Text>
                                <View className='flex-row flex-wrap'>
                                    {options.map((option, i) => (
                                        <Text key={i} className='w-1/2 text-sm'>
                                            {ALPHABET_SET[i]}. {option}
                                        </Text>
                                    ))}
                                </View>
                            </View>
                        )
                    })}
                </View>
            </View>
        )
    },
    renderAnswerSheet: ({ data, config, options: shuffledOptionsMap, quizData }) => {
        const blanks = extractBlanks(data.text, config.start ?? 1, (displayNo, localNo, originalContent) => {
            return (
                <MultipleChoice
                    key={displayNo}
                    displayNo={displayNo}
                    localNo={localNo}
                    options={shuffledOptionsMap![originalContent]}
                    groupId={data.id}
                    quizData={quizData}
                />
            )
        })
        return <View className='flex flex-col gap-2 mb-4'>{blanks}</View>
    },
    getDefaultValue: () => ({
        id: nanoid(8),
        text: '<p>This is a <code>test</code> sentence.</p>',
        type: 'cloze',
        questions: [
            { original: 'test', distractors: ['trial', 'exam', 'quiz'] }
        ]
    }),
})

/**
 * Reading comprehension strategy for React Native
 */
const readingStrategy: QuestionStrategy<ReadingData> = createQuestionStrategy<ReadingData>({
    scorePerQuestion: 2,
    keyPerLine: 5,
    renderRubric: () => <View />,
    getQuestionCount: (data) => data.questions.length,
    getCorrectAnswers: (data) => data.questions.map(q => q.a[q.correct]),
    renderPaper: ({ data, config, quizData }) => {
        // Parse the text content (simplified HTML parsing)
        const textContent = data.text
            .replace(/<\/?p>/g, '\n')
            .replace(/<\/?h[1-6]>/g, '\n')
            .replace(/<br\s*\/?>/g, '\n')
            .replace(/<strong>(.*?)<\/strong>/g, '$1')
            .replace(/<em>(.*?)<\/em>/g, '$1')
            .replace(/<\/?[^>]+(>|$)/g, '')
            .trim()

        return (
            <View className='mb-4'>
                <Text className='mb-4 leading-6'>{textContent}</Text>
                <View className='flex flex-col gap-4'>
                    {data.questions.map((q, index) => {
                        const displayNo = (config.start ?? 1) + index
                        const localNo = index + 1
                        return (
                            <View key={index} className='mb-3'>
                                <Text className='font-bold mb-2'>
                                    {displayNo}. {q.q}
                                </Text>
                                <Choice localNo={localNo} options={q.a} groupId={data.id} quizData={quizData} />
                            </View>
                        )
                    })}
                </View>
            </View>
        )
    },
    renderAnswerSheet: ({ data, config, quizData }) => (
        <View className='mb-4 flex flex-col gap-4'>
            {data.questions.map((q, index) => {
                const displayNo = (config.start ?? 1) + index
                const localNo = index + 1
                return (
                    <View key={index} className='mb-3'>
                        <Text className='font-bold mb-2'>
                            {displayNo}. {q.q}
                        </Text>
                        <Choice localNo={localNo} options={q.a} groupId={data.id} quizData={quizData} />
                    </View>
                )
            })}
        </View>
    ),
    getDefaultValue: () => ({
        id: nanoid(8),
        text: '<p>This is a reading passage.</p>',
        type: 'reading',
        questions: [{
            q: 'What is this?',
            a: ['A passage', 'A question', 'A test', 'An answer'],
            correct: 0,
        }],
    }),
})

/**
 * Sentence choice strategy for React Native
 */
const sentenceChoiceStrategy: QuestionStrategy<SentenceChoiceData, string[]> = createQuestionStrategy<SentenceChoiceData, string[]>({
    scorePerQuestion: 2,
    keyPerLine: 4,
    renderRubric: () => <SectionTitle>Sentence Choice</SectionTitle>,
    getQuestionCount: (data) => extractCodeContent(data.text).length,
    getOptions: (data) => {
        const correct = extractCodeContent(data.text)
        const allOptions = [...correct, ...data.distractors]
        return fastShuffle(getSeed(allOptions.join('')) * 1000, allOptions)
    },
    renderPaper: ({ data, config, options, quizData }) => {
        const parsedContent = replaceBlanks(data.text, config.start ?? 1, (displayNo, localNo) => {
            return (
                <MultipleChoice
                    displayNo={displayNo}
                    localNo={localNo}
                    options={options}
                    groupId={data.id}
                    quizData={quizData}
                />
            )
        })
        return (
            <View className='mb-4'>
                <View className='mb-3 p-2 border border-gray-300 rounded-lg'>
                    {options!.map((opt, idx) => (
                        <Text key={idx} className='mb-1 text-sm'>
                            {ALPHABET_SET[idx]}. {opt}
                        </Text>
                    ))}
                </View>
                {parsedContent}
            </View>
        )
    },
    renderAnswerSheet: ({ data, config, options, quizData }) => {
        const blanks = extractBlanks(data.text, config.start ?? 1, (displayNo, localNo) => {
            return (
                <MultipleChoice
                    key={displayNo}
                    displayNo={displayNo}
                    localNo={localNo}
                    options={options}
                    groupId={data.id}
                    quizData={quizData}
                />
            )
        })
        return (
            <View className='mb-4'>
                <View className='mb-3 p-2 border border-gray-300 rounded-lg'>
                    {options!.map((opt, idx) => (
                        <Text key={idx} className='mb-1 text-sm'>
                            {ALPHABET_SET[idx]}. {opt}
                        </Text>
                    ))}
                </View>
                <View className='flex flex-col gap-2'>{blanks}</View>
            </View>
        )
    },
    getDefaultValue: () => ({
        id: nanoid(8),
        text: '<p>This is a sentence. <code>This is another sentence.</code></p>',
        type: 'sentences',
        distractors: ['This is a distractor.']
    }),
})

/**
 * Custom strategy for React Native
 */
const customStrategy: QuestionStrategy<CustomData> = createQuestionStrategy<CustomData>({
    keyPerLine: 0,
    getQuestionCount: ({ key }) => {
        if (key.replace(/<[^>]*>/g, '').length > 0)
            return 1
        else
            return 0
    },
    getCorrectAnswers: () => [],
    renderPaper: ({ data }) => {
        const textContent = data.paper
            .replace(/<\/?p>/g, '\n')
            .replace(/<\/?h[1-6]>/g, '\n')
            .replace(/<br\s*\/?>/g, '\n')
            .replace(/<strong>(.*?)<\/strong>/g, '$1')
            .replace(/<em>(.*?)<\/em>/g, '$1')
            .replace(/<\/?[^>]+(>|$)/g, '')
            .trim()
        return <Text>{textContent}</Text>
    },
    renderAnswerSheet: () => <View />,
    renderRubric: () => <View />,
    getDefaultValue: () => ({
        id: nanoid(8),
        type: 'custom',
        paper: '<h1>Final English Exam</h1>',
        key: '<h1>Final English Exam (Key)</h1>',
    }),
})

export const questionStrategies = {
    fishing: fishingStrategy,
    cloze: clozeStrategy,
    grammar: grammarStrategy,
    reading: readingStrategy,
    sentences: sentenceChoiceStrategy,
    listening: listeningStrategy,
    custom: customStrategy,
} as const

export const questionStrategiesList = Object.values(questionStrategies)
