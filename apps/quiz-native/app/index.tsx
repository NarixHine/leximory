import { View, Text, ScrollView, Pressable } from 'react-native'
import { trpc } from '@/lib/trpc'
import { Link } from 'expo-router'
import moment from 'moment'

export default function HomeScreen() {
  const { data: papers, isLoading } = trpc.paper.getPublic.useQuery()

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-lg">Loading...</Text>
      </View>
    )
  }

  const pinnedPapers = papers?.filter(p => p.is_pinned) || []
  const otherPapers = papers?.filter(p => !p.is_pinned) || []

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-6">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-4xl font-bold mb-2">猫谜</Text>
          <Text className="text-sm text-gray-600">陪你一起解开英语之谜</Text>
        </View>

        {/* Pinned Papers Section */}
        {pinnedPapers.length > 0 && (
          <View className="mb-6">
            <Text className="text-3xl font-bold mb-3">从这些练习开始</Text>
            {pinnedPapers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </View>
        )}

        {/* All Papers Section */}
        <View>
          <Text className="text-3xl font-bold mb-3">浏览所有</Text>
          {otherPapers.map((paper) => (
            <PaperCard key={paper.id} paper={paper} />
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

function PaperCard({ paper }: { paper: any }) {
  return (
    <Link href={`/paper/${paper.id}`} asChild>
      <Pressable className="bg-gray-50 rounded-xl p-4 mb-3 active:bg-gray-100">
        <Text className="text-xl font-semibold mb-2">{paper.title}</Text>
        <View className="flex-row flex-wrap gap-2 mb-2">
          {paper.tags?.map((tag: string, idx: number) => (
            <View key={idx} className="bg-blue-100 px-2 py-1 rounded">
              <Text className="text-xs text-blue-800">{tag}</Text>
            </View>
          ))}
        </View>
        <Text className="text-xs text-gray-500">
          {moment(paper.created_at).format('ll')}
        </Text>
      </Pressable>
    </Link>
  )
}
