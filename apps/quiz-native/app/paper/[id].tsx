import { View, Text, ScrollView, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { trpc } from '@/lib/trpc'

export default function PaperScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const paperId = parseInt(id)

  const { data: paper, isLoading } = trpc.paper.get.useQuery({ id: paperId })

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!paper) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-lg text-gray-600">Paper not found</Text>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-6">
        <Text className="text-3xl font-bold mb-6">{paper.title}</Text>

        {/* Paper Content */}
        {paper.content?.map((section, sectionIdx) => (
          <View key={sectionIdx} className="mb-8">
            <SectionRenderer section={section} sectionIdx={sectionIdx} />
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

function SectionRenderer({ section, sectionIdx }: { section: any; sectionIdx: number }) {
  const { type, data } = section

  if (type === 'choice') {
    return <ChoiceSection data={data} sectionIdx={sectionIdx} />
  }

  if (type === 'blank') {
    return <BlankSection data={data} sectionIdx={sectionIdx} />
  }

  return null
}

function ChoiceSection({ data, sectionIdx }: { data: any; sectionIdx: number }) {
  return (
    <View>
      <Text className="text-lg font-semibold mb-4">
        Section {sectionIdx + 1}: Multiple Choice
      </Text>
      {data.questions?.map((q: any, idx: number) => (
        <View key={idx} className="mb-6 bg-gray-50 p-4 rounded-lg">
          <Text className="font-medium mb-3">
            {idx + 1}. {q.question}
          </Text>
          {q.options?.map((option: string, optIdx: number) => (
            <View key={optIdx} className="mb-2 ml-4">
              <Text className="text-gray-700">
                {String.fromCharCode(65 + optIdx)}. {option}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

function BlankSection({ data, sectionIdx }: { data: any; sectionIdx: number }) {
  return (
    <View>
      <Text className="text-lg font-semibold mb-4">
        Section {sectionIdx + 1}: Fill in the Blanks
      </Text>
      <View className="bg-gray-50 p-4 rounded-lg">
        <Text className="leading-6">
          {data.passage || 'No passage available'}
        </Text>
      </View>
    </View>
  )
}
