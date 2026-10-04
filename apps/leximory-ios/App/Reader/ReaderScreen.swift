import SwiftUI
import LeximoryCore

private enum DocumentState {
    case loading
    case loaded(ReadingDocument)
    case failed(String)
}

struct DefinitionPresentation: Identifiable {
    let source: DefinitionSource
    let definition: Definition?
    var id: String { source.id }
}

struct ReaderScreen: View {
    let article: FixtureArticle
    let playback: PlaybackController
    var language = "English"
    var client: MobileClient? = nil
    var loadDocument: (@Sendable (TextID) async throws -> ReadingDocument)? = nil
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var state: DocumentState = .loading
    @State private var definition: DefinitionPresentation?
    @State private var anchor: CGRect = .zero
    @State private var titlePastViewport = false
    @State private var refreshedArticle: FixtureArticle?
    private var currentArticle: FixtureArticle { refreshedArticle ?? article }
    private var jumpToEnd: Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("--reader-end")
        #else
        false
        #endif
    }

    var body: some View {
        ZStack {
            switch state {
            case .loading: ProgressView("正在打开文章……")
            case .failed(let message):
                ContentUnavailableView {
                    Label("暂时无法打开文章", systemImage: "doc.text")
                } description: { Text(message) } actions: { Button("重试") { Task { await load() } } }
            case .loaded(let document):
                ReadingTextView(document: document, article: currentArticle, language: language, textID: article.id, jumpToEnd: jumpToEnd,
                    onTitleVisibilityChange: { titlePastViewport = !$0 }, onDefine: { selection, embedded, rect in
                        anchor = rect
                        definition = DefinitionPresentation(source: .article(selection), definition: embedded)
                    })
                .background(LeximoryPalette.paper)
                .popover(item: $definition, attachmentAnchor: .rect(.rect(anchor)), arrowEdge: .top) { item in
                    DefinitionView(item: item, client: client, language: language, isPopover: sizeClass == .regular)
                        .presentationCompactAdaptation(.sheet)
                        .presentationDragIndicator(.visible)
                        .presentationCornerRadius(sizeClass == .regular ? 32 : nil)
                        .presentationBackground(LeximoryPalette.shell)
                }
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if playback.textID == article.id { PlaybackBar(playback: playback) }
                }
            }
        }
        .toolbar(.hidden, for: .tabBar)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                if titlePastViewport {
                    Text(currentArticle.title).editorialFont(17, language: language)
                        .lineLimit(1).truncationMode(.tail).foregroundStyle(LeximoryPalette.ink)
                        .accessibilityIdentifier("reader-scrolled-title")
                }
            }
            ToolbarItemGroup(placement: .topBarTrailing) {
                if case .loaded(let document) = state {
                    let audioIDs = Array(Set(document.blocks.compactMap(\.audioId))).sorted()
                    if !audioIDs.isEmpty {
                        Menu("录音", systemImage: "headphones") {
                            ForEach(audioIDs, id: \.self) { audioID in
                                Button(client != nil ? "播放录音" : audioID == "fixture_recording" ? "播放测试音频" : "录音暂不可用") {
                                    playback.toggle(textID: article.id, audioID: audioID, title: article.title)
                                }
                            }
                        }
                    }
                }
                if let client {
                    Menu("阅读选项", systemImage: "ellipsis") {
                        ShareLink(item: client.webURL.appending(path: "read/\(article.id.rawValue)")) {
                            Label("分享", systemImage: "square.and.arrow.up")
                        }
                        Link(destination: client.webURL.appending(path: "read/\(article.id.rawValue)")) {
                            Label("在网页版打开", systemImage: "safari")
                        }
                    }
                }
            }
        }
        .task(id: article.id) { definition = nil; await load() }
    }
    private func load() async {
        state = .loading
        do {
            if let client {
                for _ in 0..<90 {
                    let details = try await client.documentDetails(textID: article.id.rawValue)
                    try Task.checkCancellation()
                    guard let document = details.document else { throw URLError(.cannotParseResponse) }
                    refreshedArticle = details.text.preview
                    if case .loaded(let previous) = state, previous.revision == document.revision { }
                    else { state = .loaded(document) }
                    guard ["annotating", "saving"].contains(details.annotationProgress ?? "") else { return }
                    try await Task.sleep(for: .seconds(2))
                }
            } else {
                let document = try await loadDocument?(article.id) ?? article.document()
                guard !Task.isCancelled else { return }
                state = .loaded(document)
            }
        }
        catch {
            if !Task.isCancelled {
                if case .loaded = state { return }
                state = .failed("无法打开文章，请检查网络后重试。")
            }
        }
    }
}

struct DefinitionView: View {
    let item: DefinitionPresentation
    let client: MobileClient?
    let language: String
    let isPopover: Bool
    @State private var contentHeight: CGFloat = 320
    @State private var bottomSafeArea: CGFloat = 0
    @State private var lookupAttempt = 0
    @State private var editing = false
    @State private var model: DefinitionModel
    @Environment(\.dismiss) private var dismiss
    @ScaledMetric(relativeTo: .body) private var bodySize = 20.0
    init(item: DefinitionPresentation, client: MobileClient?, language: String, isPopover: Bool) {
        self.item = item; self.client = client; self.language = language; self.isPopover = isPopover
        _model = State(initialValue: DefinitionModel(embedded: item.definition))
    }
    private var lemma: String {
        if case .ready(let definition, _) = model.state { return definition.lemma }
        return item.definition?.lemma ?? item.source.text
    }
    var body: some View {
        GeometryReader { geometry in
            let safeAreaBottom = geometry.safeAreaInsets.bottom
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if editing, let client, let word = model.savedWord {
                        VocabularyEditor(id: word.id, client: client, language: language, updated: { word in
                            model.edited(word); editing = false
                        }, cancel: { editing = false })
                    } else {
                    Text(lemma).font(LeximoryTypography.prose(28, language: language))
                        .bold().foregroundStyle(LeximoryPalette.ink).textSelection(.enabled)
                        .accessibilityAddTraits(.isHeader)
                    switch model.state {
                    case .ready(let definition, _):
                        section("释义", content: definition.definition)
                        if let etymology = definition.etymology, !etymology.isEmpty { section("语源", content: etymology) }
                        if let cognates = definition.cognates, !cognates.isEmpty { section("同源词", content: cognates) }
                        HStack(spacing: 16) {
                            if let client {
                                Button { model.save(client: client, source: item.source) } label: {
                                    Group {
                                        if case .saving = model.saveState { ProgressView().tint(LeximoryPalette.paper) }
                                        else { Image(systemName: saved ? "book.closed.fill" : "book.closed").font(.system(size: 20)) }
                                    }.frame(width: 48, height: 48)
                                        .foregroundStyle(LeximoryPalette.paper).background(LeximoryPalette.ink, in: Circle())
                                }.buttonStyle(.plain).disabled(!canSave)
                                    .accessibilityLabel(saved ? "已收藏" : "收藏词汇")
                            }
                            if model.savedWord != nil {
                                Button("编辑", systemImage: "pencil") { editing = true }
                                    .labelStyle(.iconOnly).frame(width: 44, height: 44)
                                    .foregroundStyle(LeximoryPalette.sage).accessibilityLabel("编辑词汇")
                            }
                            if let dictionaryURL {
                                Link(destination: dictionaryURL) {
                                    Image(systemName: "arrow.up.right.square").font(.system(size: 20))
                                        .frame(width: 44, height: 44).foregroundStyle(LeximoryPalette.muted)
                                }.accessibilityLabel("在词典中查看")
                            }
                        }.padding(.top, 2)
                        if case .uncertain = model.saveState {
                            Text("未能确认收藏结果，请先在网页版查看，避免重复收藏。")
                                .font(LeximoryTypography.interface(13)).foregroundStyle(LeximoryPalette.muted)
                        }
                    case .generating(let preview):
                        if client != nil {
                            if !preview.isEmpty { section("释义", content: preview) }
                            ProgressView("正在理解语境……")
                                .frame(maxWidth: .infinity, minHeight: preview.isEmpty ? 140 : 60, alignment: .center)
                        } else { Text("示例模式暂不支持生成语境释义。").foregroundStyle(LeximoryPalette.muted) }
                    case .failed(let message):
                        Text(message).foregroundStyle(LeximoryPalette.muted)
                        if client != nil { Button("重试", systemImage: "arrow.clockwise") { lookupAttempt += 1 } }
                    }
                    }
                }.padding(.horizontal, isPopover ? 28 : 24)
                    .padding(.top, isPopover ? 28 : 24).padding(.bottom, isPopover ? 28 : 24)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
            }
            .scrollDismissesKeyboard(.interactively)
            .ignoresSafeArea(.container, edges: isPopover ? [] : .bottom)
            .onGeometryChange(for: CGFloat.self) { _ in safeAreaBottom } action: { if !editing { bottomSafeArea = $0 } }
        }
        .frame(width: isPopover ? 480 : nil)
        .frame(height: isPopover ? min(contentHeight, 620) : nil)
        // A height detent adds the bottom safe area; our content already includes its edge inset.
        .presentationDetents([.height(max(1, min(contentHeight, 560) - bottomSafeArea)), .large])
        .background(LeximoryPalette.shell).accessibilityIdentifier("definition-tray")
        .accessibilityAction(.escape) { dismiss() }
        .task(id: "\(item.id):\(lookupAttempt)") {
            if let client { await model.generate(client: client, source: item.source) }
        }
        .onDisappear { model.cancel() }
    }
    private var saved: Bool { if case .saved = model.saveState { return true }; return false }
    private var canSave: Bool { if case .idle = model.saveState { return true }; return false }
    private var dictionaryURL: URL? {
        let base: URL?
        switch language {
        case "English": base = URL(string: "https://www.etymonline.com/word/")
        case "Chinese": base = URL(string: "https://www.zdic.net/hans/")
        case "French": base = URL(string: "https://www.cnrtl.fr/definition/")
        case "Japanese":
            return URL(string: "https://jisho.org/search/")?.appending(path: lemma)
        default: base = nil
        }
        return base?.appending(path: lemma)
    }
    private func section(_ title: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(LeximoryTypography.interface(17)).foregroundStyle(LeximoryPalette.illustration)
            Text(annotationMarkdown(content, size: bodySize)).font(Font(LeximoryTypography.proseUI(bodySize, language: language)))
                .foregroundStyle(LeximoryPalette.ink).lineSpacing(5).textSelection(.enabled)
        }
    }

}

func annotationMarkdown(_ content: String, size: CGFloat) -> AttributedString {
    let bracketed = content.replacingOccurrences(of: #"`([^`]+)`"#, with: "`[$1]`", options: .regularExpression)
    var result = (try? AttributedString(markdown: bracketed, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(content)
    for run in result.runs where run.inlinePresentationIntent?.contains(.code) == true {
        result[run.range].font = Font(LeximoryTypography.face("SourceCodePro-Medium", size: size * 0.85))
    }
    return result
}
