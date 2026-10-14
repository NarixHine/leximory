import SwiftUI
import LeximoryCore

struct ReviewAnnotatedAnswer: View {
    let content: String
    let feedback: ReviewFeedback?
    let language: String
    @State private var selected: ReviewInlineNote?
    var body: some View {
        Text(attributed).font(LeximoryTypography.prose(18, language: language)).lineSpacing(8)
            .fixedSize(horizontal: false, vertical: true).textSelection(.enabled)
            .environment(\.openURL, OpenURLAction { url in
                guard url.scheme == "leximory-review", let index = Int(url.lastPathComponent) else { return .discarded }
                if url.host == "correction", let pairs = feedback?.badPairs, pairs.indices.contains(index) {
                    selected = ReviewInlineNote(id: url.absoluteString, title: "润色建议", original: pairs[index].original, content: pairs[index].improved)
                } else if url.host == "praise", let pairs = feedback?.goodPairs, pairs.indices.contains(index) {
                    selected = ReviewInlineNote(id: url.absoluteString, title: "自然的表达", original: pairs[index].original, content: pairs[index].note)
                }
                return .handled
            })
            .popover(item: $selected) { note in
                VStack(alignment: .leading, spacing: 14) {
                    Text(note.title).font(LeximoryTypography.interface(14)).foregroundStyle(.secondary)
                    Text(note.original).font(LeximoryTypography.prose(20, language: language))
                    AnnotationMarkdownText(content: note.content, size: 17, language: language)
                }.padding(24).frame(idealWidth: 360, maxWidth: 400)
                    .presentationCompactAdaptation(.sheet).presentationDetents([.medium, .large]).presentationDragIndicator(.visible)
            }
    }
    private var attributed: AttributedString {
        var value = AttributedString(content)
        for (index, pair) in (feedback?.goodPairs ?? []).enumerated() {
            if !pair.original.isEmpty, let range = value.range(of: pair.original) {
                value[range].backgroundColor = Color.pink.opacity(0.14)
                value[range].foregroundColor = LeximoryPalette.ink
                value[range].link = URL(string: "leximory-review://praise/\(index)")
            }
        }
        for (index, pair) in (feedback?.badPairs ?? []).enumerated() {
            if !pair.original.isEmpty, let range = value.range(of: pair.original) {
                value[range].backgroundColor = Color.yellow.opacity(0.25)
                value[range].foregroundColor = LeximoryPalette.ink
                value[range].link = URL(string: "leximory-review://correction/\(index)")
            }
        }
        return value
    }
}

private struct ReviewInlineNote: Identifiable {
    let id: String
    let title: String
    let original: String
    let content: String
}
