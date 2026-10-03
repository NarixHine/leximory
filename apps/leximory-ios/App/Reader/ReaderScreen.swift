import SwiftUI
import LeximoryCore

private enum DocumentState {
    case loading
    case loaded(ReadingDocument)
    case failed(String)
}

struct DefinitionPresentation: Identifiable {
    let selection: ReadingSelection
    let definition: Definition?
    var id: String { selection.id }
}

struct ReaderScreen: View {
    let article: FixtureArticle
    let playback: PlaybackController
    @State private var state: DocumentState = .loading
    @State private var definition: DefinitionPresentation?
    @State private var anchor: CGRect = .zero
    @State private var jumpToEnd = false

    var body: some View {
        Group {
            switch state {
            case .loading: ProgressView("Opening passage…")
            case .failed(let message):
                ContentUnavailableView {
                    Label("Couldn't open this passage", systemImage: "doc.text")
                } description: { Text(message) } actions: { Button("Try again") { load() } }
            case .loaded(let document):
                ReadingTextView(document: document, textID: article.id, jumpToEnd: jumpToEnd,
                    onDefine: { selection, embedded, rect in
                        anchor = rect
                        definition = DefinitionPresentation(selection: selection, definition: embedded)
                    })
                .background(LeximoryPalette.paper)
                .popover(item: $definition, attachmentAnchor: .rect(.rect(anchor)), arrowEdge: .top) { item in
                    DefinitionView(item: item)
                        .presentationCompactAdaptation(.sheet)
                        .presentationDetents([.medium, .large])
                }
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if playback.textID == article.id { PlaybackBar(playback: playback) }
                }
            }
        }
        .navigationTitle(article.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if case .loaded(let document) = state {
                    let audioIDs = Array(Set(document.blocks.compactMap(\.audioId))).sorted()
                    if !audioIDs.isEmpty {
                        Menu("Recordings", systemImage: "headphones") {
                            ForEach(audioIDs, id: \.self) { audioID in
                                Button(audioID == "fixture_recording" ? "Play diagnostic fixture tone" : "Unavailable recording") {
                                    playback.toggle(textID: article.id, audioID: audioID, title: article.title)
                                }
                            }
                        }
                    }
                }
                Menu("Reading options", systemImage: "ellipsis") {
                    Button("Go to final section", systemImage: "arrow.down.to.line") { jumpToEnd.toggle() }
                }
            }
        }
        .task(id: article.id) { definition = nil; load() }
    }
    private func load() {
        do { state = .loaded(try article.document()) }
        catch { state = .failed("The local reading fixture could not be decoded.") }
    }
}

private struct DefinitionView: View {
    let item: DefinitionPresentation
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text(item.definition?.lemma ?? item.selection.text)
                        .font(.system(.largeTitle, design: .serif, weight: .semibold))
                        .textSelection(.enabled)
                    if let definition = item.definition {
                        if definition.lemma != item.selection.text {
                            Text(item.selection.text).font(.subheadline).foregroundStyle(.secondary)
                        }
                        section("Meaning", content: definition.definition)
                        if let etymology = definition.etymology { section("Origin", content: etymology) }
                        if let cognates = definition.cognates { section("Related words", content: cognates) }
                    } else {
                        Text("Contextual lookup isn't available in this preview.")
                            .foregroundStyle(.secondary)
                    }
                    Text("Vocabulary saving isn't available in this preview.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .padding(24)
                .frame(maxWidth: 480, alignment: .leading)

            }
            .background(LeximoryPalette.paper)
            .navigationTitle("Definition").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
    private func section(_ title: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.subheadline).foregroundStyle(LeximoryPalette.sage)
            Text(.init(content)).font(.system(.body, design: .serif))
                .lineSpacing(5).textSelection(.enabled)
        }
    }
}
