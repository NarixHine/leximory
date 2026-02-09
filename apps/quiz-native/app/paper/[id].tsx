import { View, Text, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { trpc } from '@/lib/trpc'
import { Paper } from '@repo/ui-native/paper'
import { useSetAtom } from 'jotai'
import { paperIdAtom } from '@repo/ui-native/paper/atoms'
import { useEffect } from 'react'

export default function PaperScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const paperId = parseInt(id)
  const setPaperId = useSetAtom(paperIdAtom)

  const { data: paper, isLoading } = trpc.paper.get.useQuery({ id: paperId })

  useEffect(() => {
    if (id) {
      setPaperId(id)
    }
  }, [id, setPaperId])

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!paper || !paper.content) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-lg text-gray-600">Paper not found</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-white">
      <View className="p-6 border-b border-gray-200">
        <Text className="text-3xl font-bold">{paper.title}</Text>
      </View>
      <Paper quizData={paper.content} mode="paper" />
    </View>
  )
}
