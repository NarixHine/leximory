import fastShuffle from 'fast-shuffle'
import Rand from 'rand-seed'
import { QuizData, QuestionStrategy, SectionAnswers } from '@repo/schema/paper'

/**
 * A reusable helper to extract the content from all <code> tags in a string.
 */
export const extractCodeContent = (text: string): string[] => {
  return text.match(/<code>(.*?)<\/code>/g)?.map(c => c.replace(/<\/?code>/g, '')) ?? []
}

/**
 * Creates a consistent numerical seed from a string for predictable shuffling.
 */
export const getSeed = (content: string): number => {
  return new Rand(content).next()
}

export { fastShuffle }

/**
 * The callback type for the dispatcher function.
 */
type StrategyCallback<T> = <K extends QuizData['type']>(
  strategy: QuestionStrategy<Extract<QuizData, { type: K }>, any>,
  data: Extract<QuizData, { type: K }>,
) => T

/**
 * The generic dispatcher function. It takes a QuizData object and a callback.
 * It safely narrows the types and invokes the callback with the correct
 * strategy and data pair.
 */
export function applyStrategy<T>(
  data: QuizData,
  callback: StrategyCallback<T>,
  strategies: Record<string, QuestionStrategy<any, any>>
): T {
  const strategy = strategies[data.type]
  return callback(strategy as any, data as any)
}

/**
 * Calculates the starting question number for each section in a quiz.
 */
export const getQuestionStarts = (
  quizData: QuizData[],
  strategies: Record<string, QuestionStrategy<any, any>>
): number[] => {
  let totalQuestions = 0
  return quizData.map(data => {
    const start = totalQuestions + 1
    totalQuestions += applyStrategy(data, (strategy, specificData) => {
      return strategy.getQuestionCount(specificData)
    }, strategies)
    return start
  })
}

/**
 * Gets the answer key for a specific section from a QuizData item.
 */
export const getSectionKeyFromData = (
  data: QuizData,
  strategies: Record<string, QuestionStrategy<any, any>>
): Record<number, string> => {
  return applyStrategy(data, (strategy, specificData) => {
    const options = strategy.getOptions?.(specificData)
    const correctAnswers = strategy.getCorrectAnswers(specificData, options)
    return correctAnswers.reduce((acc, answer, index) => {
      acc[index + 1] = answer
      return acc
    }, {} as Record<number, string>)
  }, strategies)
}

/**
 * Gets the answer key for a specific section by section ID.
 */
export const getSectionKey = (
  quizData: QuizData[],
  sectionId: string,
  strategies: Record<string, QuestionStrategy<any, any>>
): Record<number, string> | null => {
  const data = quizData.find((item) => item.id === sectionId)
  if (!data) return null
  return getSectionKeyFromData(data, strategies)
}

/**
 * Generates a section-based answer key for all sections of a quiz.
 */
export const getSectionBasedKey = (
  quizData: QuizData[],
  strategies: Record<string, QuestionStrategy<any, any>>
): SectionAnswers => {
  return quizData.reduce((acc, data) => {
    acc[data.id] = getSectionKeyFromData(data, strategies)
    return acc
  }, {} as SectionAnswers)
}

/**
 * Checks user answers against the correct answers for a quiz.
 */
export const checkAnswers = (
  quizData: QuizData[],
  userAnswers: SectionAnswers,
  strategies: Record<string, QuestionStrategy<any, any>>
): Record<string, Record<number, boolean>> => {
  const results: Record<string, Record<number, boolean>> = {}
  const sectionKeyMap = getSectionBasedKey(quizData, strategies)

  for (const data of quizData) {
    const sectionId = data.id
    const sectionAnswers = userAnswers[sectionId] || {}
    const sectionKey = sectionKeyMap[sectionId]
    results[sectionId] = {}

    for (const localNoStr in sectionAnswers) {
      const localNo = Number(localNoStr)
      const userAns = sectionAnswers[localNo]
      const correctAns = sectionKey?.[localNo]

      if (userAns === null || userAns === undefined || correctAns === undefined || correctAns === null) {
        results[sectionId][localNo] = false
        continue
      }

      results[sectionId][localNo] = applyStrategy(data, (strategy) => {
        return strategy.isCorrect(userAns, correctAns)
      }, strategies)
    }
  }

  return results
}

/**
 * Calculates the perfect score for a given quiz.
 */
export const computePerfectScore = (
  quizData: QuizData[],
  strategies: Record<string, QuestionStrategy<any, any>>
): number => {
  return quizData.reduce((acc, data) => {
    return acc + applyStrategy(data, (strategy, specificData) => {
      const questionCount = strategy.getQuestionCount(specificData)
      return questionCount * (strategy.scorePerQuestion ?? 1)
    }, strategies)
  }, 0)
}

/**
 * Computes the total score for a student's answers.
 */
export const computeTotalScore = (
  quizData: QuizData[],
  userAnswers: SectionAnswers,
  strategies: Record<string, QuestionStrategy<any, any>>
): number => {
  const results = checkAnswers(quizData, userAnswers, strategies)
  let totalScore = 0

  for (const data of quizData) {
    const sectionId = data.id
    const sectionResults = results[sectionId] || {}

    for (const localNoStr in sectionResults) {
      if (sectionResults[Number(localNoStr)]) {
        totalScore += applyStrategy(data, (strategy) => {
          return strategy.scorePerQuestion ?? 1
        }, strategies)
      }
    }
  }
  return totalScore
}
