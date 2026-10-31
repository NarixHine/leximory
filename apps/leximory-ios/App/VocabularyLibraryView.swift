import SwiftUI
import LeximoryCore

struct VocabularyLibraryView: View {
    let library: FixtureLibrary
    let client: MobileClient
    let closeCorpus: () -> Void
    @Environment(\.nativeSync) private var sync
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var words: [SavedWord] = []
    @State private var cursor: String?
    @State private var loading = false
    @State private var error: String?
    @State private var selected: SavedWord?
    var body: some View {
        GeometryReader { geometry in
                let contentWidth = min(geometry.size.width, LeximoryLayout.textGalleryMeasure)
                ScrollView {
                    VStack(alignment: .leading, spacing: 28) {
                        HStack(alignment: .top, spacing: 16) {
                            Text(library.name).editorialFont(32, language: library.language)
                                .foregroundStyle(LeximoryPalette.ink).fixedSize(horizontal: false, vertical: true)
                                .accessibilityAddTraits(.isHeader)
                            Spacer(minLength: 0)
                            Button("返回", systemImage: "chevron.left", action: closeCorpus)
                                .labelStyle(.iconOnly).buttonStyle(.glass).buttonBorderShape(.circle)
                                .frame(minWidth: 44, minHeight: 44).tint(.primary)
                                .accessibilityIdentifier("corpus-show-texts")
                        }
                        timeline(columns: contentWidth < 600 ? 2 : 3)
                    }.padding(24).frame(maxWidth: LeximoryLayout.textGalleryMeasure).frame(maxWidth: .infinity)
                }.background(LeximoryPalette.paper)
            }.navigationTitle("已存词汇").navigationBarTitleDisplayMode(.inline)
                .task { await load(reset: true) }
                .refreshable { await load(reset: true) }
                .tint(.primary)
                .accessibilityIdentifier("corpus-\(library.id.rawValue)")
    }
    private func timeline(columns: Int) -> some View {
        LazyVStack(alignment: .leading, spacing: 22) {
            ForEach(days, id: \.self) { day in
                if !day.isEmpty { Text(dateLabel(day)).interfaceFont(13).foregroundStyle(.secondary) }
                wordGrid(words.filter { dateKey($0) == day }, columns: columns)
            }
            if loading { HStack(spacing: 10) { ProgressView(); Text("正在加载词汇").interfaceFont(15) }.frame(maxWidth: .infinity) }
            if cursor != nil && !loading {
                Button("更多", systemImage: "chevron.down") { Task { await load(reset: false) } }.frame(maxWidth: .infinity, minHeight: 44)
            }
            if let error { Text(error).interfaceFont(14).foregroundStyle(LeximoryPalette.muted) }
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
                        }.id(word.id).presentationCompactAdaptation(.sheet).presentationDragIndicator(.visible)
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

struct CorpusWordTray: View {
    @Environment(\.nativeSync) private var sync
    @State private var editor: VocabularyEditModel
    private let initialWord: SavedWord
    private var word: SavedWord { editor.word ?? initialWord }
    let library: FixtureLibrary
    let client: MobileClient
    let isPopover: Bool
    let updated: (SavedWord) -> Void
    let deleted: ((String) -> Void)?
    @Environment(\.dismiss) private var dismiss
    @State private var verifiedWord: SavedWord?
    @State private var confirmingDelete = false
    @State private var deleting = false
    @State private var deletionError: String?
    @State private var editing = false
    init(word: SavedWord, library: FixtureLibrary, client: MobileClient, isPopover: Bool, deleted: ((String) -> Void)? = nil, updated: @escaping (SavedWord) -> Void) {
        initialWord = word
        _editor = State(initialValue: VocabularyEditModel(word: word))
        self.library = library; self.client = client; self.isPopover = isPopover; self.updated = updated; self.deleted = deleted
    }
    @State private var height: CGFloat = 320
    @State private var bottomInset: CGFloat = 0
    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if editing {
                        VocabularyEditor(model: editor, language: library.language, submit: {
                            editor.submit(persist: { try await client.editWord(id: word.id, fields: $0) },
                                reload: { try await client.savedWord(id: word.id) }, changed: { _ in if let word = editor.word { updated(word) } })
                            editing = false
                        }, cancel: { editing = false })
                    } else {
                        Text(word.fields.lemma).font(LeximoryTypography.prose(24, language: library.language, bold: true))
                        section("释义", word.fields.definition)
                        if let content = word.fields.etymology { section("语源", content) }
                        if let content = word.fields.cognates { section("同源词", content) }
                        if let error = editor.error {
                            Text(error).interfaceFont(13).foregroundStyle(LeximoryPalette.muted)
                        }
                        if let deletionError { Text(deletionError).interfaceFont(13).foregroundStyle(.secondary) }
                        HStack(spacing: 16) {
                            if library.owned && (verifiedWord?.protected ?? word.protected) != true {
                                Button("编辑词汇", systemImage: "pencil") { editing = true }
                                    .labelStyle(.iconOnly).frame(width: 48, height: 48)
                                    .foregroundStyle(LeximoryPalette.paper).background(LeximoryPalette.ink, in: Circle())
                                    .disabled(sync?.online == false || deleting)
                            }
                            if deleted != nil, library.owned, (verifiedWord?.protected ?? word.protected) != true {
                                Button("删除词汇", systemImage: "trash", role: .destructive) { confirmingDelete = true }
                                    .labelStyle(.iconOnly).frame(width: 44, height: 44)
                                    .disabled(sync?.online == false || deleting || editor.saving)
                                    .accessibilityIdentifier("review-delete-word")
                            }
                            if let dictionaryURL {
                                DictionaryLink(url: dictionaryURL, client: client) { dismiss() }
                            }
                        }
                    }
                }.foregroundStyle(LeximoryPalette.ink).padding(24).frame(maxWidth: 580).frame(maxWidth: .infinity)
                    .fixedSize(horizontal: false, vertical: true)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
            }.scrollDismissesKeyboard(.interactively).accessibilityIdentifier("vocabulary-editor-scroll")
                .ignoresSafeArea(.container, edges: isPopover ? [] : .bottom).onAppear { bottomInset = geometry.safeAreaInsets.bottom }
        }.frame(width: isPopover ? 400 : nil)
            .frame(idealHeight: isPopover ? max(160, min(height, 720)) : nil,
                   maxHeight: isPopover ? max(160, min(height, 720)) : nil,
                   alignment: .top)
            .background(LeximoryPalette.shell)
            .presentationDetents([.height(max(1, min(height, 720) - bottomInset)), .large])
            .presentationCornerRadius(isPopover ? 32 : nil)
            .interactiveDismissDisabled(deleting)
            .task(id: initialWord.id) {
                // Timeline rows do not carry welcome-word protection. Fetch it before enabling removal.
                verifiedWord = try? await MutationRetry.run { try await client.savedWord(id: initialWord.id) }
            }
            .confirmationDialog("删除词汇？", isPresented: $confirmingDelete, titleVisibility: .visible) {
                Button("删除", role: .destructive) {
                    guard !deleting, !editor.saving else { return }
                    let target = verifiedWord ?? word
                    deleting = true; deletionError = nil
                    Task {
                        defer { deleting = false }
                        do {
                            try await client.removeWord(target)
                            SavedWordsWidgetSync.schedule(client: client)
                            deleted?(target.id); dismiss()
                        }
                        catch { deletionError = "删除未能完成，请重试。" }
                    }
                }
                Button("取消", role: .cancel) {}
            } message: { Text("删除后无法恢复。") }
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
            Text(label).interfaceFont(14).foregroundStyle(.secondary)
            AnnotationMarkdownText(content: content, size: 17, language: library.language)
        }
    }
}
