import SwiftUI
import LeximoryCore

struct VocabularyLibraryView: View {
    let library: FixtureLibrary
    let client: MobileClient
    @Environment(\.nativeSync) private var sync
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var words: [SavedWord] = []
    @State private var cursor: String?
    @State private var loading = false
    @State private var error: String?
    @State private var selected: SavedWord?
    var body: some View {
        GeometryReader { geometry in
                ScrollView {
                    VStack(alignment: .leading, spacing: 28) {
                        Text(library.name).editorialFont(32, language: library.language)
                            .foregroundStyle(LeximoryPalette.ink).fixedSize(horizontal: false, vertical: true)
                            .accessibilityAddTraits(.isHeader)
                        timeline(columns: geometry.size.width < 600 ? 2 : geometry.size.width < 1000 ? 3 : 4)
                    }.padding(24).frame(maxWidth: 1200).frame(maxWidth: .infinity)
                }.background(LeximoryPalette.paper)
            }.navigationTitle("语料本").navigationBarTitleDisplayMode(.inline)
                .task { await load(reset: true) }
                .refreshable { await load(reset: true) }
                .tint(LeximoryPalette.sage)
    }
    private func timeline(columns: Int) -> some View {
        LazyVStack(alignment: .leading, spacing: 22) {
            ForEach(days, id: \.self) { day in
                if !day.isEmpty { Text(dateLabel(day)).font(LeximoryTypography.interface(13)).foregroundStyle(LeximoryPalette.illustration) }
                wordGrid(words.filter { dateKey($0) == day }, columns: columns)
            }
            if loading { HStack(spacing: 10) { ProgressView(); Text("正在加载词汇……").font(LeximoryTypography.interface(15)) }.frame(maxWidth: .infinity) }
            if cursor != nil && !loading {
                Button("更多", systemImage: "chevron.down") { Task { await load(reset: false) } }.frame(maxWidth: .infinity, minHeight: 44)
            }
            if let error { Text(error).font(LeximoryTypography.interface(14)).foregroundStyle(LeximoryPalette.muted) }
            if words.isEmpty && error != nil { Button("重试") { Task { await load(reset: true) } } }
        }
    }
    private func wordGrid(_ items: [SavedWord], columns: Int) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: columns), spacing: 12) {
            ForEach(items) { word in
                Button { selected = word } label: {
                    Text(word.fields.lemma).font(LeximoryTypography.prose(19, language: library.language))
                        .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, minHeight: 58).padding(12)
                        .background(LeximoryPalette.shell, in: RoundedRectangle(cornerRadius: 28))
                }.buttonStyle(.plain).foregroundStyle(LeximoryPalette.ink)
                    .popover(isPresented: Binding(get: { selected?.id == word.id }, set: { if !$0 { selected = nil } }), arrowEdge: nil) {
                        CorpusWordTray(word: word, library: library, client: client, isPopover: sizeClass == .regular) { updated in
                            if let index = words.firstIndex(where: { $0.id == updated.id }) { words[index] = updated }
                        }.presentationCompactAdaptation(.sheet).presentationDragIndicator(.visible)
                    }
            }
        }
    }
    private var days: [String] { var seen = Set<String>(); return words.map(dateKey).filter { seen.insert($0).inserted } }
    private func dateKey(_ word: SavedWord) -> String { String((word.createdAt ?? "").prefix(10)) }
    private func dateLabel(_ key: String) -> String {
        let parts = key.split(separator: "-")
        return parts.count == 3 ? "\(parts[0])年\(Int(parts[1]) ?? 0)月\(Int(parts[2]) ?? 0)日" : key
    }
    private func load(reset: Bool) async {
        guard !loading else { return }
        if let cached = await client.localStore?.value([SavedWord].self, for: "words/\(library.id.rawValue)") { words = cached }
        guard sync?.online != false else { return }
        loading = words.isEmpty; error = nil
        defer { loading = false }
        do { words = try await client.allVocabulary(libraryID: library.id.rawValue); cursor = nil }
        catch {
            if MobileClient.isAccessFailure(error) { words = []; self.error = "暂时无法访问这个语料本。" }
            else if !Task.isCancelled, words.isEmpty { self.error = "请联网后同步语料本。" }
        }
    }
}

private struct CorpusWordTray: View {
    @Environment(\.nativeSync) private var sync
    @State private var word: SavedWord
    let library: FixtureLibrary
    let client: MobileClient
    let isPopover: Bool
    let updated: (SavedWord) -> Void
    @State private var editing = false
    init(word: SavedWord, library: FixtureLibrary, client: MobileClient, isPopover: Bool, updated: @escaping (SavedWord) -> Void) {
        _word = State(initialValue: word)
        self.library = library; self.client = client; self.isPopover = isPopover; self.updated = updated
    }
    @State private var height: CGFloat = 320
    @State private var bottomInset: CGFloat = 0
    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if editing {
                        VocabularyEditor(id: word.id, client: client, language: library.language, updated: { value in word = value; updated(value); editing = false }, cancel: { editing = false })
                    } else {
                        Text(word.fields.lemma).font(LeximoryTypography.prose(24, language: library.language)).bold()
                        section("释义", word.fields.definition)
                        if let content = word.fields.etymology { section("语源", content) }
                        if let content = word.fields.cognates { section("同源词", content) }
                        HStack(spacing: 16) {
                            if library.owned && word.protected != true {
                                Button("编辑词汇", systemImage: "pencil") { editing = true }
                                    .labelStyle(.iconOnly).frame(width: 48, height: 48)
                                    .foregroundStyle(LeximoryPalette.paper).background(LeximoryPalette.sage, in: Circle())
                                    .disabled(sync?.online == false)
                            }
                            if let dictionaryURL {
                                Link(destination: dictionaryURL) {
                                    Image(systemName: "arrow.up.right.square").font(.system(size: 20))
                                        .frame(width: 44, height: 44).foregroundStyle(LeximoryPalette.muted)
                                }.accessibilityLabel("在词典中查看")
                            }
                        }
                    }
                }.foregroundStyle(LeximoryPalette.ink).padding(24).frame(maxWidth: 580).frame(maxWidth: .infinity)
                    .fixedSize(horizontal: false, vertical: true)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
            }.scrollDismissesKeyboard(.interactively).accessibilityIdentifier("vocabulary-editor-scroll")
                .ignoresSafeArea(.container, edges: .bottom).onAppear { bottomInset = geometry.safeAreaInsets.bottom }
        }.frame(width: isPopover ? 400 : nil, height: isPopover ? max(160, min(height, 720)) : nil)
            .background(LeximoryPalette.shell)
            .presentationDetents([.height(max(1, min(height, 720) - bottomInset)), .large])
            .presentationCornerRadius(isPopover ? 32 : nil)
    }
    private var dictionaryURL: URL? {
        let base: String?
        switch library.language {
        case "English": base = "https://www.etymonline.com/word/"
        case "Chinese": base = "https://www.zdic.net/hans/"
        case "French": base = "https://www.cnrtl.fr/definition/"
        case "Japanese": base = "https://jisho.org/search/"
        default: base = nil
        }
        return base.flatMap { URL(string: $0)?.appending(path: word.fields.lemma) }
    }
    private func section(_ label: String, _ content: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label).font(LeximoryTypography.interface(14)).foregroundStyle(LeximoryPalette.illustration)
            AnnotationMarkdownText(content: content, size: 17, language: library.language)
        }
    }
}
