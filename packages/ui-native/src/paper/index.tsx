import { ScrollView, View } from 'react-native'
import { QuizData } from '@repo/schema/paper'
import { questionStrategies } from './strategies'
import { applyStrategy, getQuestionStarts } from '../shared/utils'

interface PaperProps {
    quizData: QuizData[]
    mode?: 'paper' | 'answerSheet'
}

/**
 * Main Paper component for React Native.
 * Renders a quiz using the strategy pattern.
 */
export function Paper({ quizData, mode = 'paper' }: PaperProps) {
    const questionStarts = getQuestionStarts(quizData, questionStrategies)

    return (
        <ScrollView className='flex-1 p-4 bg-white'>
            {quizData.map((data, index) => {
                const config = { start: questionStarts[index] }

                return (
                    <View key={data.id} className='mb-6'>
                        {/* Render section rubric/title */}
                        {applyStrategy(data, questionStrategies, (strategy) => {
                            return strategy.renderRubric()
                        })}

                        {/* Render section content */}
                        {applyStrategy(data, questionStrategies, (strategy, specificData) => {
                            const options = strategy.getOptions?.(specificData)

                            if (mode === 'answerSheet') {
                                return strategy.renderAnswerSheet({
                                    data: specificData,
                                    config,
                                    options,
                                    quizData,
                                })
                            }

                            return strategy.renderPaper({
                                data: specificData,
                                config,
                                options,
                                quizData,
                            })
                        })}
                    </View>
                )
            })}
        </ScrollView>
    )
}
