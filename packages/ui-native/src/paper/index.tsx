import { View, Text } from 'react-native'
import { QuizItems } from '@repo/schema/paper'

export function Paper({ data }: { data: QuizItems }) {
  return (
    <View className="w-full p-4">
      {data.map((section, index) => (
        <View key={section.id} className="mb-6">
          <Text className="text-lg font-bold mb-2">
            Section {index + 1}: {section.type}
          </Text>
          {/* Section content will be rendered here by strategies */}
          <SectionRenderer section={section} />
        </View>
      ))}
    </View>
  )
}

function SectionRenderer({ section }: { section: QuizItems[number] }) {
  // This will be expanded with the strategy pattern implementation
  return (
    <View>
      <Text className="text-gray-600">
        {section.type} section (to be implemented with strategies)
      </Text>
    </View>
  )
}
