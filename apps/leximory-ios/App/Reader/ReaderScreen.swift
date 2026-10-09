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
    var isDynamic: Bool { definition == nil }
}

struct ReaderScreen: View {
    let article: FixtureArticle
    let playback: PlaybackController
    var language = "English"
    var client: MobileClient? = nil
    var loadDocument: (@Sendable (TextID) async throws -> ReadingDocument)? = nil
    @Environment(\.nativeSync) private var sync
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var state: DocumentState = .loading
    @State private var definition: DefinitionPresentation?
    @State private var titlePastViewport = false
    @State private var playbackHeight: CGFloat = 76
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
            case .loading: ReadingLoadingIndicator("正在打开文章……")
            case .failed(let message):
                LeximoryUnavailableView("暂时无法打开文章", systemImage: "doc.text", message: message) { Button("重试") { Task { await load() } } }
            case .loaded(let document):
                ReadingTextView(document: document, article: currentArticle, language: language, textID: article.id, jumpToEnd: jumpToEnd,
                    bottomObstruction: playback.textID == article.id ? playbackHeight + 24 : 0, localStore: client?.localStore, client: client, sync: sync, readOnly: sync?.online == false,
                    onTitleVisibilityChange: { titlePastViewport = !$0 }, onDefine: { selection, embedded, _ in
                        definition = DefinitionPresentation(source: .article(selection), definition: embedded)
                    })
                .background(LeximoryPalette.paper)
                .ignoresSafeArea(.container, edges: [.top, .bottom])

            }
        }
        .background(LeximoryPalette.paper.ignoresSafeArea())
        .overlay(alignment: .bottom) {
            if playback.textID == article.id {
                PlaybackBar(playback: playback)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { playbackHeight = $0 }
                    .padding(.horizontal, 16).padding(.bottom, 12)
                    .transition(reduceMotion ? .opacity : .offset(y: 8).combined(with: .opacity))
            }
        }
        .animation(reduceMotion ? nil : .timingCurve(0.25, 1, 0.5, 1, duration: 0.24), value: playback.textID == article.id)
        .sheet(item: Binding(get: { sizeClass != .regular && definition?.isDynamic == false ? definition : nil }, set: { definition = $0 })) { item in
            DefinitionView(item: item, client: client, language: language, isPopover: false)
                .id(item.id)
                .presentationDragIndicator(.visible)
                .presentationBackground(LeximoryPalette.annotationSurface)
        }
        .overlay(alignment: .top) {
            if let item = definition, item.isDynamic {
                DefinitionTopTray(item: item, client: client, language: language) { definition = nil }
                    .id(item.id)
            }
        }
        .toolbar(.hidden, for: .tabBar)
        .toolbar(.visible, for: .navigationBar)
        .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(currentArticle.title).editorialFont(22, language: language)
                    .lineLimit(1).truncationMode(.tail).foregroundStyle(LeximoryPalette.ink)
                    .padding(.horizontal, 16).padding(.vertical, 7)
                    .glassEffect(.regular, in: Capsule())
                    .opacity(titlePastViewport ? 1 : 0)
                    .offset(y: reduceMotion || titlePastViewport ? 0 : 5)
                    .animation(reduceMotion ? nil : .timingCurve(0.25, 1, 0.5, 1,
                        duration: titlePastViewport ? 0.24 : 0.18), value: titlePastViewport)
                    .allowsHitTesting(false)
                    .accessibilityHidden(!titlePastViewport)
                    .accessibilityIdentifier("reader-scrolled-title")
            }
            ToolbarItemGroup(placement: .topBarTrailing) {
                if case .loaded(let document) = state {
                    let audioIDs = Array(Set(document.blocks.compactMap(\.audioId))).sorted()
                    if !audioIDs.isEmpty && sync?.online != false {
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
        .onChange(of: sync?.revision) { _, _ in Task { await load() } }
    }
    private func load() async {
        if let cached = await client?.cachedDocument(textID: article.id.rawValue), let document = cached.document {
            if case .loaded(let previous) = state, previous == document { }
            else { state = .loaded(document) }
            refreshedArticle = cached.text.preview
        }
        if sync?.online == false {
            if case .loaded = state { return }
            state = .failed("无法打开文章，请连接网络后重试。")
            return
        }
        do {
            if let client {
                for _ in 0..<90 {
                    let details = try await client.documentDetails(textID: article.id.rawValue)
                    try Task.checkCancellation()
                    guard let document = details.document else { throw URLError(.cannotParseResponse) }
                    refreshedArticle = details.text.preview
                    if case .loaded(let previous) = state, previous == document { }
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
                if let failure = MobileClient.cause(of: error) as? MobileFailure,
                   ["inaccessible", "unauthenticated"].contains(failure.error.code) {
                    state = .failed("暂时无法访问这篇文章。")
                    return
                }
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
    let topTrayHeight: CGFloat?
    let closeTray: (() -> Void)?
    let trayDragging: Bool
    let onScrollPermission: ((Bool) -> Void)?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var contentHeight: CGFloat = 64
    @State private var bottomSafeArea: CGFloat = 0
    @State private var lookupAttempt = 0
    @State private var editing = false
    @State private var model: DefinitionModel
    @Environment(\.nativeSync) private var sync
    @Environment(\.dismiss) private var dismiss
    @Environment(\.horizontalSizeClass) private var sizeClass
    @ScaledMetric(relativeTo: .body) private var compactBodySize = 17.0
    @ScaledMetric(relativeTo: .body) private var regularBodySize = 18.0
    private var bodySize: Double {
        if topTrayHeight != nil { return sizeClass == .regular ? regularBodySize * 17 / 18 : compactBodySize * 16 / 17 }
        return sizeClass == .regular ? regularBodySize : compactBodySize
    }
    init(item: DefinitionPresentation, client: MobileClient?, language: String, isPopover: Bool, topTrayHeight: CGFloat? = nil, closeTray: (() -> Void)? = nil, trayDragging: Bool = false, onScrollPermission: ((Bool) -> Void)? = nil) {
        self.item = item; self.client = client; self.language = language; self.isPopover = isPopover
        self.topTrayHeight = topTrayHeight; self.closeTray = closeTray
        self.trayDragging = trayDragging; self.onScrollPermission = onScrollPermission
        _model = State(initialValue: DefinitionModel(embedded: item.definition))
    }
    private var lemma: String {
        if case .ready(let definition, _) = model.state { return definition.lemma }
        return item.definition?.lemma ?? item.source.text
    }
    private var waiting: Bool {
        if case .generating(let preview) = model.state { return preview.isEmpty && client != nil }
        return false
    }
    private var trayHeight: CGFloat? {
        guard let available = topTrayHeight else { return nil }
        return min(max(64, contentHeight), max(64, available * 0.78))
    }
    var body: some View {
        VStack(spacing: 0) {
            GeometryReader { geometry in
                let safeAreaBottom = geometry.safeAreaInsets.bottom
                ScrollView {
                    VStack(alignment: .leading, spacing: item.isDynamic ? 12 : 16) {
                        if editing, let client, let editor = model.editor {
                            VocabularyEditor(model: editor, language: language, failure: model.saveError, submit: {
                                model.submitEdit(client: client)
                                editing = false
                            }, cancel: { editing = false })
                        } else {
                            if !waiting {
                                HStack(alignment: .center, spacing: 10) {
                                    Text(lemma).font(LeximoryTypography.prose(item.isDynamic ? 20 : 24, language: language))
                                        .bold().foregroundStyle(LeximoryPalette.ink).textSelection(.enabled)
                                        .accessibilityAddTraits(.isHeader)
                                }
                            }
                            switch model.state {
                            case .ready(let definition, _):
                                section("释义", content: definition.definition)
                                if let etymology = definition.etymology, !etymology.isEmpty { section("语源", content: etymology) }
                                if let cognates = definition.cognates, !cognates.isEmpty { section("同源词", content: cognates) }
                                definitionActions
                                if let error = model.saveError ?? model.editor?.error {
                                    Text(error)
                                        .font(LeximoryTypography.interface(13)).foregroundStyle(LeximoryPalette.muted)
                                }
                            case .generating(let preview):
                                if client != nil {
                                    if !preview.isEmpty { section("释义", content: preview) }
                                    HStack(spacing: 10) { ProgressView(); Text("正在理解语境……").font(LeximoryTypography.interface(15)) }.frame(maxWidth: .infinity, minHeight: waiting && topTrayHeight != nil ? 32 : 24, alignment: .center)
                                } else { Text("示例模式暂不支持生成语境释义。").foregroundStyle(LeximoryPalette.muted) }
                            case .failed(let message):
                                Text(message).foregroundStyle(LeximoryPalette.muted)
                                if client != nil { Button("重试", systemImage: "arrow.clockwise") { lookupAttempt += 1 } }
                            }
                        }
                    }.padding(.horizontal, item.isDynamic ? 20 : 24)
                        .padding(.vertical, waiting ? 16 : item.isDynamic ? 20 : 24)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height in
                            if abs(height - contentHeight) > 1 { contentHeight = height }
                        }
                        .frame(maxWidth: .infinity, alignment: .top)
                }
                .scrollDisabled(trayDragging)
                .scrollBounceBehavior(.basedOnSize)
                .onScrollGeometryChange(for: Bool.self) { geometry in
                    geometry.contentOffset.y <= -geometry.contentInsets.top + 1
                } action: { _, atTop in onScrollPermission?(atTop) }
                .scrollDismissesKeyboard(.interactively)
                .ignoresSafeArea(.container, edges: isPopover || topTrayHeight != nil ? [] : .bottom)
                .onGeometryChange(for: CGFloat.self) { _ in safeAreaBottom } action: { if !editing { bottomSafeArea = $0 } }
            }
            .frame(height: topTrayHeight != nil ? trayHeight : nil)
            .clipped()
        }
        .animation(reduceMotion ? nil : .timingCurve(0.32, 0.72, 0, 1, duration: 0.24), value: trayHeight)
        .frame(width: isPopover ? 400 : nil)
        .frame(idealHeight: isPopover ? max(120, min(contentHeight, 520)) : nil,
               maxHeight: isPopover ? max(120, min(contentHeight, 520)) : nil,
               alignment: .top)
        // A height detent adds the bottom safe area; our content already includes its edge inset.
        .presentationDetents([.height(max(160, min(contentHeight, 560) - bottomSafeArea)), .large])
        .background(topTrayHeight == nil ? LeximoryPalette.annotationSurface : Color.clear).accessibilityIdentifier("definition-tray")
        .accessibilityAction(.escape) { if let closeTray { closeTray() } else { dismiss() } }
        .task(id: "\(item.id):\(lookupAttempt)") {
            if sync?.online == false, item.definition == nil { model.offline() }
            else if let client { await model.generate(client: client, source: item.source) }
        }
    }
    private var definitionActions: some View {
        HStack(spacing: 16) {
            if let client {
                if case .idle = model.saveState {
                    Button { model.save(client: client, source: item.source) } label: {
                        Image(systemName: "book.closed").font(.system(size: 20))
                            .frame(width: 48, height: 48).foregroundStyle(LeximoryPalette.paper)
                            .background(LeximoryPalette.sage, in: Circle())
                    }.buttonStyle(.plain).disabled(sync?.online == false).accessibilityLabel("收藏词汇")
                } else {
                    Button { editing = true } label: {
                        Image(systemName: "pencil").font(.system(size: 20))
                            .frame(width: 48, height: 48).foregroundStyle(LeximoryPalette.paper)
                            .background(LeximoryPalette.ink, in: Circle())
                    }.buttonStyle(.plain).accessibilityLabel("编辑词汇")
                        .disabled(sync?.online == false)
                }
            }
            if let dictionaryURL {
                Link(destination: dictionaryURL) {
                    Image(systemName: "arrow.up.right.square").font(.system(size: 20))
                        .frame(width: 44, height: 44).foregroundStyle(LeximoryPalette.muted)
                }.accessibilityLabel("在词典中查看")
            }
        }
    }
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
            Text(title).font(LeximoryTypography.interface(14)).foregroundStyle(LeximoryPalette.illustration)
            AnnotationMarkdownText(content: content, size: bodySize, language: language)
                .foregroundStyle(LeximoryPalette.ink)
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

/// The card moves independently of the reading document; its children own its height.
struct DefinitionTopTray: View {
    let item: DefinitionPresentation
    let client: MobileClient?
    let language: String
    let close: () -> Void
    @State private var presented = false
    @State private var extent: CGFloat = 100
    @State private var dismissal: Task<Void, Never>?
    @State private var entrance: Task<Void, Never>?
    @State private var laidOut = false
    @State private var displacement: CGFloat = 0
    @State private var dragging = false
    @State private var canMove = true
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var settling: Animation {
        reduceMotion ? .easeOut(duration: 0.12) : .timingCurve(0.32, 0.72, 0, 1, duration: 0.5)
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .top) {
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture { dismissTray() }
                    .accessibilityHidden(true)
                DefinitionView(item: item, client: client, language: language, isPopover: false,
                               topTrayHeight: geometry.size.height, closeTray: dismissTray,
                               trayDragging: dragging, onScrollPermission: { canMove = $0 })
                    .frame(width: min(LeximoryLayout.annotationMeasure, geometry.size.width - 24))
                    .clipShape(RoundedRectangle(cornerRadius: 36, style: .continuous))
                    .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 36, style: .continuous))
                    .shadow(color: .black.opacity(0.14), radius: 20, y: 8)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height in
                        extent = height
                        guard !laidOut else { return }
                        laidOut = true
                        entrance = Task { @MainActor in
                            // Commit the measured offscreen frame before animating into view.
                            try? await Task.sleep(for: .milliseconds(32))
                            guard !Task.isCancelled else { return }
                            presented = true
                        }
                    }
                    .offset(y: presented ? displacement : -extent - geometry.safeAreaInsets.top)
                    .opacity(reduceMotion && !presented ? 0 : 1)
                    .animation(settling, value: presented)
                    .simultaneousGesture(moveGesture)
                    .padding(.top, 8)
                    .frame(maxWidth: .infinity, alignment: .top)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .coordinateSpace(name: "annotation-tray")
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("definition-top-tray")
        .onDisappear { entrance?.cancel(); dismissal?.cancel() }
    }

    private var moveGesture: some Gesture {
        DragGesture(minimumDistance: 8, coordinateSpace: .named("annotation-tray"))
            .onChanged { value in
                let distance = value.translation.height
                guard dismissal == nil,
                      dragging || (canMove && distance < 0 && abs(distance) > abs(value.translation.width)) else { return }
                dragging = true
                // Follow upward movement one-to-one; use Vaul's damping beyond the resting edge.
                var transaction = Transaction()
                transaction.disablesAnimations = true
                withTransaction(transaction) {
                    displacement = distance < 0 ? distance : max(0, 8 * (log1p(distance) - 2))
                }
            }
            .onEnded { value in
                guard dragging else { return }
                dragging = false
                if -value.translation.height > extent * 0.25 || value.velocity.height < -400 {
                    dismissTray()
                } else {
                    withAnimation(settling) { displacement = 0 }
                }
            }
    }

    private func dismissTray() {
        guard dismissal == nil else { return }
        entrance?.cancel()
        presented = false
        dismissal = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(reduceMotion ? 120 : 500))
            guard !Task.isCancelled else { return }
            close()
        }
    }
}
