import { Text, View } from 'react-native'
import { QuizData, QuestionStrategy } from '@repo/schema/paper'
import { extractCodeContent } from '../../shared/utils'

/**
 * Creates a question strategy with type safety and defaults for React Native.
 */
export function createQuestionStrategy<T extends QuizData, O = unknown>(
    config: Partial<QuestionStrategy<T, O>> & { keyPerLine: number }
): QuestionStrategy<T, O> {
    const defaults: Omit<QuestionStrategy<T, O>, 'keyPerLine'> = {
        getQuestionCount: (data) => ('text' in data ? extractCodeContent(data.text).length : 0),
        getOptions: () => undefined as O,
        getCorrectAnswers: (data) => ('text' in data ? extractCodeContent(data.text) : []),
        isCorrect: (userAnswer, correctAnswer) => userAnswer === correctAnswer,
        renderPaper: () => <View />,
        getDefaultValue: () => {
            throw new Error('getDefaultValue must be implemented for each strategy')
        },
        renderRubric: () => <View />,
        scorePerQuestion: 1,
    }

    return { ...defaults, ...config }
}

/**
 * Renders a section title for React Native.
 */
export const SectionTitle = ({ children }: { children: string }) => (
    <Text className='text-2xl font-bold mb-4'>{children}</Text>
)

/**
 * Renders options in a table-like layout for React Native.
 */
export const OptionsTable = ({ options, perRow = 2 }: { options: string[], perRow?: number }) => {
    const rows: string[][] = []
    for (let i = 0; i < options.length; i += perRow) {
        rows.push(options.slice(i, i + perRow))
    }

    return (
        <View className='mb-4 p-2 border border-gray-300 rounded-lg'>
            {rows.map((row, rowIndex) => (
                <View key={rowIndex} className='flex-row justify-between mb-2'>
                    {row.map((option, colIndex) => (
                        <Text key={colIndex} className='flex-1 text-sm'>
                            {option}
                        </Text>
                    ))}
                </View>
            ))}
        </View>
    )
}
