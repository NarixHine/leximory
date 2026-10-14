public func learningLanguageName(_ code: String) -> String {
    ["en": "English", "fr": "French", "ja": "Japanese", "zh": "Chinese", "nl": "Dutch"][code] ?? code
}
