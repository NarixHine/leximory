import SwiftUI
import LeximoryCore

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
                        Text(word.fields.lemma).font(LeximoryTypography.prose(isPopover ? 22 : 20, language: library.language, bold: true))
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
        VStack(alignment: .leading, spacing: 2) {
            Text(label).interfaceFont(14).foregroundStyle(.secondary)
            AnnotationMarkdownText(content: content, size: isPopover ? 18 : 17, language: library.language)
        }
    }
}
