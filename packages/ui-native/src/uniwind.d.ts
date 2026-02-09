/// <reference types="react" />
/// <reference types="react-native" />

declare module 'react-native' {
  interface ViewProps {
    className?: string
  }

  interface TextProps {
    className?: string
  }

  interface ScrollViewProps {
    className?: string
  }

  interface PressableProps {
    className?: string
  }

  interface TextInputProps {
    className?: string
  }

  interface ImageProps {
    className?: string
  }

  interface TouchableOpacityProps {
    className?: string
  }

  interface TouchableHighlightProps {
    className?: string
  }

  interface FlatListProps<ItemT> {
    className?: string
  }

  interface SectionListProps<ItemT, SectionT> {
    className?: string
  }
}

export {}
