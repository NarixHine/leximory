import { View, Text, Pressable, TextInput } from 'react-native'
import { useAtomValue, useSetAtom } from 'jotai'
import { viewModeAtom, submittedAnswersAtom, answersAtom, setAnswerAtom } from '../atoms'
import { ALPHABET_SET } from '../config'
import { memo } from 'react'
import { getSectionKey } from '../../shared/utils'
import { QuizData } from '@repo/schema/paper'
import { questionStrategies } from '../strategies'

/**
 * Hook to get the correct answer for a question.
 */
const useCorrectAnswer = ({ sectionId, localNo, quizData }: { sectionId: string, localNo: number, quizData: QuizData[] }) => {
    if (!quizData) return null
    const sectionKey = getSectionKey(quizData, sectionId, questionStrategies)
    return sectionKey?.[localNo] ?? null
}

/**
 * Props for the Blank component.
 */
interface BlankProps {
    displayNo: number
    localNo: number
    groupId: string
    quizData: QuizData[]
    blankCount?: number
}

const Blank = ({ displayNo, localNo, groupId, quizData, blankCount = 1 }: BlankProps) => {
    const answers = useAtomValue(answersAtom)
    const submittedAnswers = useAtomValue(submittedAnswersAtom)
    const viewMode = useAtomValue(viewModeAtom)
    const answer = answers[groupId]?.[localNo]
    const submittedAnswer = submittedAnswers[groupId]?.[localNo]
    const correctAnswer = useCorrectAnswer({ sectionId: groupId, localNo, quizData })

    const checkAnswerCorrectness = () => {
        const questionGroup = quizData?.find((item) => item.id === groupId)
        if (!questionGroup) return false
        const { type } = questionGroup
        const strategy = questionStrategies[type]
        return type && correctAnswer && submittedAnswer ? strategy.isCorrect(submittedAnswer, correctAnswer) : false
    }

    const isCorrect = viewMode === 'revise' && checkAnswerCorrectness()
    const isWrong = viewMode === 'revise' && !checkAnswerCorrectness()

    return (
        <View className='flex-row items-center flex-wrap'>
            {new Array(blankCount).fill(0).map((_, index) => (
                <View key={index} className='mx-1'>
                    <Text className={`border-b-2 ${isWrong ? 'border-red-500 text-red-500' : isCorrect ? 'border-green-500 text-green-500' : 'border-gray-400'} px-2 py-1`}>
                        {answer ? (viewMode === 'revise' ? '✓' : '✓') : '○'} {displayNo}
                    </Text>
                </View>
            ))}
            {viewMode === 'revise' && isWrong && (
                <Text className='ml-2 text-sm'>
                    (<Text className='line-through'>{submittedAnswer}</Text>; <Text className='text-green-600'>{correctAnswer}</Text>)
                </Text>
            )}
        </View>
    )
}

const MemoizedBlank = memo(Blank)

/**
 * MultipleChoice component for cloze/fishing/sentence choice questions.
 */
export const MultipleChoice = ({
    displayNo,
    localNo,
    options,
    groupId,
    quizData
}: {
    displayNo: number
    localNo: number
    options?: string[]
    groupId: string
    quizData: QuizData[]
}) => {
    const answers = useAtomValue(answersAtom)
    const setAnswer = useSetAtom(setAnswerAtom)
    const viewMode = useAtomValue(viewModeAtom)
    const answer = viewMode === 'revise' ? undefined : answers[groupId]?.[localNo]
    const submittedAnswers = useAtomValue(submittedAnswersAtom)
    const submittedAnswer = submittedAnswers[groupId]?.[localNo]
    const correctAnswer = useCorrectAnswer({ sectionId: groupId, localNo, quizData })

    if (!options || options.length === 0) {
        return <MemoizedBlank displayNo={displayNo} localNo={localNo} groupId={groupId} quizData={quizData} />
    }

    return (
        <View>
            <MemoizedBlank displayNo={displayNo} localNo={localNo} groupId={groupId} quizData={quizData} />
            {viewMode === 'normal' && (
                <View className='flex-row flex-wrap gap-2 mt-2'>
                    {options.map((option, index) => {
                        const isSelected = answer === option
                        return (
                            <Pressable
                                key={index}
                                className={`px-3 py-2 rounded-lg border ${
                                    isSelected
                                        ? 'bg-purple-500 border-purple-500'
                                        : 'bg-gray-100 border-gray-300'
                                }`}
                                onPress={() => setAnswer({ sectionId: groupId, localQuestionNo: localNo, option })}
                            >
                                <Text className={isSelected ? 'text-white font-semibold' : 'text-gray-800'}>
                                    {ALPHABET_SET[index]}. {option}
                                </Text>
                            </Pressable>
                        )
                    })}
                </View>
            )}
            {viewMode === 'revise' && (
                <View className='flex-row flex-wrap gap-2 mt-2'>
                    {options.map((option, index) => {
                        const isCorrect = option === correctAnswer
                        const isUserAnswer = option === submittedAnswer
                        return (
                            <View
                                key={index}
                                className={`px-3 py-2 rounded-lg ${
                                    isCorrect
                                        ? 'bg-green-100'
                                        : isUserAnswer
                                            ? 'bg-red-100'
                                            : 'bg-gray-50'
                                }`}
                            >
                                <Text className={`${isCorrect ? 'text-green-700 font-semibold' : isUserAnswer ? 'text-red-700' : 'text-gray-600'}`}>
                                    {ALPHABET_SET[index]}. {option}
                                </Text>
                            </View>
                        )
                    })}
                </View>
            )}
        </View>
    )
}

/**
 * FillInTheBlank component for grammar questions.
 */
export const FillInTheBlank = ({
    groupId,
    displayNo,
    localNo,
    quizData,
    blankCount = 1
}: {
    groupId: string
    displayNo: number
    localNo: number
    quizData: QuizData[]
    blankCount?: number
}) => {
    const answers = useAtomValue(answersAtom)
    const setAnswer = useSetAtom(setAnswerAtom)
    const answer = answers[groupId]?.[localNo]
    const viewMode = useAtomValue(viewModeAtom)

    if (viewMode === 'revise') {
        return (
            <MemoizedBlank
                blankCount={blankCount}
                displayNo={displayNo}
                localNo={localNo}
                groupId={groupId}
                quizData={quizData}
            />
        )
    }

    return (
        <View>
            <MemoizedBlank blankCount={blankCount} displayNo={displayNo} localNo={localNo} groupId={groupId} quizData={quizData} />
            <TextInput
                className='border border-gray-300 rounded-lg px-3 py-2 mt-2 bg-white'
                value={answer ?? ''}
                onChangeText={(text) => setAnswer({ sectionId: groupId, localQuestionNo: localNo, option: text })}
                placeholder='Type your answer...'
                autoCapitalize='none'
                autoCorrect={false}
            />
        </View>
    )
}
