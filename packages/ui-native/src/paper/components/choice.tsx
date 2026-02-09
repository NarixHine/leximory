import { View, Text, Pressable } from 'react-native'
import { useSetAtom, useAtomValue } from 'jotai'
import { viewModeAtom, submittedAnswersAtom, setAnswerAtom, answersAtom } from '../atoms'
import { ALPHABET_SET } from '../config'
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
 * Choice component for rendering multiple choice questions.
 * @param localNo - The 1-based question number within the section (not global)
 * @param options - Array of option texts
 * @param groupId - The section ID
 * @param quizData - The quiz data array
 */
const Choice = ({
    localNo,
    options,
    groupId,
    quizData
}: {
    localNo: number
    options: string[]
    groupId: string
    quizData: QuizData[]
}) => {
    const setAnswer = useSetAtom(setAnswerAtom)
    const answers = useAtomValue(answersAtom)
    const viewMode = useAtomValue(viewModeAtom)
    const answer = answers[groupId]?.[localNo]
    const submittedAnswer = useAtomValue(submittedAnswersAtom)[groupId]?.[localNo]
    const correctAnswer = useCorrectAnswer({ sectionId: groupId, localNo, quizData })

    return (
        <View className='pb-2 flex flex-col gap-2'>
            {options.map((option, index) => {
                const isCorrect = option === correctAnswer
                const isUserAnswer = option === submittedAnswer
                const isSelected = option === answer

                switch (viewMode) {
                    case 'revise':
                        return (
                            <View key={index} className='flex-row items-center gap-2'>
                                <View
                                    className={`w-6 h-6 rounded-full items-center justify-center ${
                                        isCorrect
                                            ? 'bg-green-500'
                                            : isUserAnswer
                                                ? 'bg-red-500'
                                                : 'bg-gray-200'
                                    }`}
                                >
                                    <Text className={`text-xs font-bold ${isCorrect || isUserAnswer ? 'text-white' : 'text-gray-600'}`}>
                                        {ALPHABET_SET[index]}
                                    </Text>
                                </View>
                                <Text className='flex-1 leading-5'>{option}</Text>
                            </View>
                        )
                    default:
                        return (
                            <Pressable
                                key={index}
                                className='flex-row items-center gap-2'
                                onPress={() => {
                                    setAnswer({ sectionId: groupId, localQuestionNo: localNo, option })
                                }}
                            >
                                <View
                                    className={`w-6 h-6 rounded-full items-center justify-center ${
                                        isSelected ? 'bg-purple-500' : 'bg-gray-200'
                                    }`}
                                >
                                    <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                                        {ALPHABET_SET[index]}
                                    </Text>
                                </View>
                                <Text className='flex-1 leading-5'>{option}</Text>
                            </Pressable>
                        )
                }
            })}
        </View>
    )
}

export default Choice
