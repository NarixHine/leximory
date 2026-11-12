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
    let sourceTitle: String?
    init(source: DefinitionSource, definition: Definition?, sourceTitle: String? = nil) {
        self.source = source; self.definition = definition
        let title = sourceTitle?.trimmingCharacters(in: .whitespacesAndNewlines)
        self.sourceTitle = title?.isEmpty == false ? title : nil
    }
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
    @Environment(\.browserWorkspace) private var workspace
    @Environment(\.browserChromeHeight) private var browserChromeHeight
    @Environment(\.browserResourceActive) private var resourceActive
    @State private var state: DocumentState = .loading
    @State private var definition: DefinitionPresentation?
    @State private var titlePastViewport = false
    @State private var playbackHeight: CGFloat = 76
    @State private var refreshedArticle: FixtureArticle?
    @State private var annotationReveal: UUID?
    @State private var fullArticleAudioID: String?
    @State private var canGenerateAudio = false
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
            case .loading: ReadingLoadingIndicator("正在打开文章")
            case .failed(let message):
                LeximoryUnavailableView("暂时无法打开文章", systemImage: "doc.text", message: message) { Button("重试") { Task { await load() } } }
            case .loaded(let document):
                ReadingTextView(document: document, article: currentArticle, language: language, textID: article.id, jumpToEnd: jumpToEnd,
                    bottomObstruction: browserChromeHeight + (playback.textID == article.id ? playbackHeight + 24 : 0), localStore: client?.localStore, client: client, sync: sync, readOnly: sync?.online == false, annotationReveal: annotationReveal, articleAudio: articleAudioButton(document: document),
                    onTitleVisibilityChange: { titlePastViewport = !$0 }, onDefine: { selection, embedded, _ in
                        var transaction = Transaction(); transaction.disablesAnimations = embedded != nil
                        withTransaction(transaction) { definition = DefinitionPresentation(source: .article(selection), definition: embedded, sourceTitle: article.title) }
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
                    .padding(.horizontal, LeximoryLayout.pageInset).padding(.bottom, 12 + browserChromeHeight)
                    .transition(reduceMotion ? .opacity : .offset(y: 8).combined(with: .opacity))
            }
        }
        .animation(reduceMotion ? nil : .timingCurve(0.25, 1, 0.5, 1, duration: 0.24), value: playback.textID == article.id)
        .sheet(item: Binding(get: { sizeClass != .regular && definition?.isDynamic == false ? definition : nil }, set: { definition = $0 })) { item in
            DefinitionView(item: item, client: client, language: language, isPopover: false)
                .id(item.id)
                .presentationDragIndicator(.visible)
                .presentationBackground { DefinitionGlassBackground() }
        }
        .overlay(alignment: .top) {
            if let item = definition, item.isDynamic {
                DefinitionTopTray(item: item, client: client, language: language) { definition = nil }
                    .id(item.id)
            }
        }
        .toolbar(.hidden, for: .tabBar)
        .toolbar(workspace == nil ? .visible : .hidden, for: .navigationBar)
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
                if let client {
                    Menu("阅读选项", systemImage: "ellipsis") {
                        Link(destination: client.webURL.appending(path: "read/\(article.id.rawValue)")) {
                            Label("在网页版打开", systemImage: "safari")
                        }
                    }
                }
            }
        }
        .task(id: article.id) { definition = nil; await load() }
        .onChange(of: workspace?.revision) { _, _ in
            guard let details = workspace?.documents[article.id.rawValue], let document = details.document else { return }
            refreshedArticle = details.text.preview
            updateAudio(details)
            if case .loaded(let previous) = state, previous == document { return }
            if resourceActive, workspace?.completionID == article.id.rawValue { annotationReveal = UUID() }
            state = .loaded(document); refreshedArticle = details.text.preview
        }
        .onChange(of: resourceActive) { _, active in
            if active { Task { await load() } }
            else { definition = nil }
        }
    }
    private func articleAudioButton(document: ReadingDocument) -> ArticleAudioButton {
        ArticleAudioButton(textID: article.id, title: currentArticle.title, document: document,
            fullAudioID: fullArticleAudioID, canGenerate: canGenerateAudio, online: sync?.online != false,
            client: client, playback: playback, onGenerated: { id in
                fullArticleAudioID = id
                workspace?.recordArticleAudio(textID: article.id.rawValue, revision: document.revision, audioID: id)
            })
    }
    private func updateAudio(_ details: RemoteDocument) {
        fullArticleAudioID = details.fullArticleAudioId
        canGenerateAudio = details.library.owned && !details.library.shadow
    }
    private func load() async {
        if let cached = await client?.cachedDocument(textID: article.id.rawValue), let document = cached.document {
            if case .loaded(let previous) = state, previous == document { }
            else { state = .loaded(document) }
            refreshedArticle = cached.text.preview
            updateAudio(cached)
        }
        if sync?.online == false {
            if case .loaded = state { return }
            state = .failed("无法打开文章，请连接网络后重试。")
            return
        }
        do {
            if let workspace {
                let revision = workspace.revision
                let details: RemoteDocument
                if let client { details = try await client.documentDetails(textID: article.id.rawValue) }
                else if let existing = workspace.documents[article.id.rawValue] { details = existing }
                else { throw URLError(.cannotParseResponse) }
                try Task.checkCancellation()
                guard workspace.revision == revision else { return }
                guard let document = details.document else { throw URLError(.cannotParseResponse) }
                workspace.recordDocument(details)
                state = .loaded(document); refreshedArticle = details.text.preview
                updateAudio(details)
                return
            }
            if let client {
                for _ in 0..<90 {
                    let details = try await client.documentDetails(textID: article.id.rawValue)
                    try Task.checkCancellation()
                    guard let document = details.document else { throw URLError(.cannotParseResponse) }
                    refreshedArticle = details.text.preview
                    updateAudio(details)
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

struct DictionaryLink: View {
    let url: URL
    let client: MobileClient?
    var closeAnnotation: (() -> Void)? = nil
    @Environment(\.browserWorkspace) private var workspace
    @State private var showsBrowser = false

    var body: some View {
        Link(destination: url) {
            Image(systemName: "arrow.up.right.square").font(.system(size: 20))
                .frame(width: 44, height: 44).foregroundStyle(LeximoryPalette.muted)
        }
        .accessibilityLabel("在词典中查看")
        .environment(\.openURL, OpenURLAction { destination in
            if let workspace {
                closeAnnotation?()
                workspace.openURL(destination)
            } else {
                showsBrowser = true
            }
            return .handled
        })
        .disabled(workspace == nil && client == nil)
        .sheet(isPresented: $showsBrowser) {
            if let client {
                NavigationStack {
                    TextBrowserScreen(client: client, initialURL: url.absoluteString)
                        .toolbar {
                            ToolbarItem(placement: .topBarTrailing) {
                                LeximorySheetCloseButton { showsBrowser = false }
                            }
                        }
                }.leximorySheetStyle()
            }
        }
    }
}

struct DefinitionView: View {
    let item: DefinitionPresentation
    let client: MobileClient?
    private let initialLanguage: String
    private var language: String {
        if let guest, let selection = try? item.source.guestSelection(title: item.sourceTitle, language: initialLanguage) {
            return learningLanguageName(guest.language(for: selection))
        }
        return model.browserTarget?.displayLanguage ?? initialLanguage
    }
    let isPopover: Bool
    let topTrayHeight: CGFloat?
    let closeTray: (() -> Void)?
    let trayDragging: Bool
    let onScrollPermission: ((Bool) -> Void)?
    let allowsFeedback: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var contentHeight: CGFloat = 64
    @State private var bottomSafeArea: CGFloat = 0
    @State private var lookupAttempt = 0
    @State private var editing = false
    @State private var saveAcknowledged = false
    @State private var streamFeedback = DefinitionStreamFeedback()
    @State private var streamImpact: UIImpactFeedbackGenerator?
    @State private var model: DefinitionModel
    @Environment(\.nativeSync) private var sync
    @Environment(\.guestSession) private var guest
    @Environment(\.accountSession) private var account
    @Environment(\.browserWorkspace) private var workspace
    @AppStorage("guest.contextual-ai-consent.v1") private var guestAIConsent = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.horizontalSizeClass) private var sizeClass
    private var bodyBaseSize: CGFloat {
        if topTrayHeight != nil { return sizeClass == .regular ? 17 : 16 }
        return sizeClass == .regular ? 18 : 17
    }
    init(item: DefinitionPresentation, client: MobileClient?, language: String, isPopover: Bool, topTrayHeight: CGFloat? = nil, closeTray: (() -> Void)? = nil, trayDragging: Bool = false, onScrollPermission: ((Bool) -> Void)? = nil, allowsFeedback: Bool = true) {
        self.item = item; self.client = client; self.initialLanguage = language; self.isPopover = isPopover
        self.topTrayHeight = topTrayHeight; self.closeTray = closeTray
        self.trayDragging = trayDragging; self.onScrollPermission = onScrollPermission
        self.allowsFeedback = allowsFeedback
        _model = State(initialValue: DefinitionModel(embedded: item.definition))
    }
    private var lemma: String {
        if let definition = model.visibleDefinition, !definition.lemma.isEmpty { return definition.lemma }
        return item.definition?.lemma ?? item.source.text
    }
    private var waiting: Bool {
        model.isGenerating && model.visibleDefinition == nil && (client != nil || guest != nil) && !requiresGuestConsent
    }
    private var requiresGuestConsent: Bool { guest != nil && item.isDynamic && !guestAIConsent }
    private var feedbackAllowed: Bool { AnnotationFeedback.supported && allowsFeedback && scenePhase == .active }
    private var streamedCharacterCount: Int {
        guard let definition = model.visibleDefinition else { return 0 }
        return definition.definition.count + (definition.etymology?.count ?? 0) + (definition.cognates?.count ?? 0)
    }
    private var trayHeight: CGFloat? {
        guard let available = topTrayHeight else { return nil }
        return min(max(64, contentHeight), max(64, available * 0.78))
    }
    private var trayContent: some View {
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
                                    Text(lemma).font(LeximoryTypography.prose(sizeClass == .regular ? 22 : 20, language: language, bold: true))
                                        .foregroundStyle(LeximoryPalette.ink).textSelection(.enabled).tint(.blue)
                                        .lineLimit(item.isDynamic ? 3 : nil)
                                        .accessibilityAddTraits(.isHeader)
                                        .accessibilityIdentifier("definition-headword")
                                    Spacer(minLength: 0)
                                    if model.isGenerating, client != nil, !requiresGuestConsent {
                                        ProgressView().controlSize(.mini).tint(.secondary)
                                            .accessibilityLabel("正在生成释义")
                                            .accessibilityIdentifier("definition-generating")
                                    }
                                }
                            }
                            if let definition = model.visibleDefinition {
                                section("释义", content: definition.definition)
                                if let etymology = definition.etymology, !etymology.isEmpty { section("语源", content: etymology) }
                                if let cognates = definition.cognates, !cognates.isEmpty { section("同源词", content: cognates) }
                            }
                            if item.isDynamic { elaborationSection }
                            switch model.state {
                            case .ready:
                                definitionActions
                                saveFailure
                            case .generating:
                                if requiresGuestConsent {
                                    Text("免费体验 20 次猫忆查。允许将所选词句交由第三方 AI 生成释义吗？")
                                        .interfaceFont(15).foregroundStyle(.secondary)
                                    Button("允许并查词") { guestAIConsent = true }
                                        .interfaceFont(17).buttonStyle(.borderedProminent).tint(LeximoryPalette.ink)
                                        .foregroundStyle(LeximoryPalette.paper)
                                } else if waiting {
                                    HStack(spacing: 10) {
                                        ProgressView().tint(LeximoryPalette.muted)
                                        Text("正在理解语境").interfaceFont(15)
                                            .foregroundStyle(LeximoryPalette.muted)
                                    }.frame(maxWidth: .infinity, minHeight: waiting && topTrayHeight != nil ? 32 : 24, alignment: .center)
                                } else if client == nil && guest == nil { Text("示例模式暂不支持生成语境释义。").foregroundStyle(LeximoryPalette.muted) }
                            case .failed(let message, _):
                                Text(message).foregroundStyle(LeximoryPalette.muted)
                                if guest != nil && model.quotaExhausted {
                                    Button("登录后继续查词") { account?.entry = AccountEntryContext(purpose: .service) }
                                } else if client != nil || guest != nil { Button("重试", systemImage: "arrow.clockwise") { lookupAttempt += 1 } }
                            }
                        }
                    }.padding(item.isDynamic ? 20 : 24)
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
                    geometry.visibleRect.maxY >= geometry.contentSize.height - 1
                } action: { _, atBottom in onScrollPermission?(atBottom) }
                .scrollDismissesKeyboard(.interactively)
                .ignoresSafeArea(.container, edges: isPopover || topTrayHeight != nil ? [] : .bottom)
                .onGeometryChange(for: CGFloat.self) { _ in safeAreaBottom } action: { if !editing { bottomSafeArea = $0 } }
            }
            .frame(height: topTrayHeight != nil ? trayHeight : nil)
            .clipped()
        }
        .animation(reduceMotion || model.isGenerating || model.elaboration.isStreaming ? nil : .timingCurve(0.32, 0.72, 0, 1, duration: 0.24), value: trayHeight)
        .frame(width: isPopover ? 400 : nil)
        .frame(idealHeight: isPopover ? max(120, min(contentHeight, 520)) : nil,
               maxHeight: isPopover ? max(120, min(contentHeight, 520)) : nil,
               alignment: .top)
        // A height detent adds the bottom safe area; our content already includes its edge inset.
        .presentationDetents([.height(max(160, min(contentHeight, 560) - bottomSafeArea)), .large])
        .accessibilityIdentifier("definition-tray")
        .accessibilityAction(.escape) { if let closeTray { closeTray() } else { dismiss() } }
    }
    private var feedbackContent: some View {
        trayContent
            .onChange(of: streamedCharacterCount) { _, count in
                updateStreamFeedback(characterCount: count)
            }
            .sensoryFeedback(.success, trigger: model.saveState) { old, new in
                shouldPlaySaveFeedback(from: old, to: new)
            }
            .onChange(of: model.isReady) { _, ready in
                announceDefinition(ready: ready)
            }
    }
    var body: some View {
        feedbackContent
            .task(id: model.saveState) { await acknowledgeSave() }
            .task(id: lookupTaskID) { await loadDefinition() }
            .onDisappear(perform: dismissDefinition)
    }
    private var lookupTaskID: String {
        "\(item.id):\(lookupAttempt):\(guest == nil || guestAIConsent)"
    }
    private func shouldPlaySaveFeedback(from old: DefinitionModel.SaveState, to new: DefinitionModel.SaveState) -> Bool {
        old == .saving && new == .saved && feedbackAllowed
    }
    private func announceDefinition(ready: Bool) {
        guard ready, allowsFeedback, scenePhase == .active, UIAccessibility.isVoiceOverRunning else { return }
        UIAccessibility.post(notification: .announcement, argument: "释义已显示")
    }
    private func loadDefinition() async {
        if sync?.online == false, item.definition == nil { model.offline() }
        else if let guest {
            guard !requiresGuestConsent else { return }
            model.startGeneration { () async throws -> (events: AsyncThrowingStream<DefinitionEvent, Error>, target: BrowserTarget?) in
                let selection = try item.source.guestSelection(title: item.sourceTitle, language: language)
                let events = try await guest.lookup(selection)
                return (events: events, target: nil)
            }
        }
        else if let client { model.startGeneration(client: client, source: item.source) }
    }
    private func dismissDefinition() {
        streamImpact = nil
        model.dismiss()
    }
    private func updateStreamFeedback(characterCount: Int) {
        let previousPulse = streamFeedback.pulse
        streamFeedback.update(characterCount: characterCount, enabled: model.isGenerating && feedbackAllowed)
        guard streamFeedback.pulse != previousPulse else { return }
        let impact = streamImpact ?? UIImpactFeedbackGenerator(style: .soft)
        streamImpact = impact
        impact.impactOccurred(intensity: 0.5)
        impact.prepare()
    }
    private func acknowledgeSave() async {
        saveAcknowledged = false
        guard case .saved = model.saveState else { return }
        if allowsFeedback, scenePhase == .active, UIAccessibility.isVoiceOverRunning {
            UIAccessibility.post(notification: .announcement, argument: "词汇已收藏")
        }
        do { try await Task.sleep(for: .milliseconds(650)) } catch { return }
        withAnimation(actionMotion) { saveAcknowledged = true }
    }
    private var definitionActions: some View {
        HStack(spacing: 16) {
            if let guest {
                Button {
                    guard let definition = model.visibleDefinition,
                          let selection = try? item.source.guestSelection(title: item.sourceTitle, language: language) else { return }
                    account?.entry = AccountEntryContext(purpose: .words,
                        word: AccountWordContext(definition: definition, original: selection.quote, quote: selection.excerpt,
                            title: selection.title, language: guest.language(for: selection)))
                } label: {
                    Image(systemName: "book.closed").font(.system(size: 20)).frame(width: 48, height: 48)
                }.buttonStyle(DefinitionPrimaryButtonStyle(reduceMotion: reduceMotion))
                    .accessibilityLabel("收藏词汇").disabled(!model.isReady)
            } else if let client {
                Button {
                    if case .idle = model.saveState {
                        var transaction = Transaction()
                        transaction.disablesAnimations = true
                        withTransaction(transaction) { model.requestSave(client: client, source: item.source) }
                    }
                    else if case .saved = model.saveState, saveAcknowledged { withAnimation(actionMotion) { editing = true } }
                } label: {
                    ZStack {
                        if model.saveState == .queued || model.saveState == .saving {
                            ProgressView().tint(LeximoryPalette.paper).transition(primarySymbolTransition)
                        } else {
                            Image(systemName: saveSymbol).font(.system(size: 20))
                                .id(saveSymbol).transition(primarySymbolTransition)
                        }
                    }.frame(width: 24, height: 24).clipped().frame(width: 48, height: 48)
                }.buttonStyle(DefinitionPrimaryButtonStyle(reduceMotion: reduceMotion)).accessibilityLabel(saveLabel)
                    .disabled(saveLocked || sync?.online == false)
                    .animation(model.saveState == .saving ? nil : actionMotion, value: model.saveState)
                    .animation(actionMotion, value: saveAcknowledged)

            }
            if item.isDynamic {
                Button {
                    if let client { model.elaborate(client: client, source: item.source) }
                    else { account?.entry = AccountEntryContext(purpose: .service) }
                } label: {
                    Image(systemName: "questionmark.circle.dashed")
                        .font(.system(size: 22)).frame(width: 44, height: 44)
                }
                .buttonStyle(.plain).foregroundStyle(LeximoryPalette.ink)
                .accessibilityLabel("进一步了解")
                .accessibilityHint("了解更多，消耗一次语境查词额度")
                .accessibilityIdentifier("definition-elaborate")
                .disabled(!model.isReady || model.elaboration.isStreaming || elaborationComplete || sync?.online == false
                    || (client != nil && model.completionID == nil) || (client == nil && guest == nil))
            }
        }
    }
    private var elaborationComplete: Bool {
        if case .ready = model.elaboration { true } else { false }
    }
    @ViewBuilder private var elaborationSection: some View {
        if case .idle = model.elaboration {} else {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text("参考").interfaceFont(14).foregroundStyle(.secondary)
                    if model.elaboration.isStreaming {
                        ProgressView().controlSize(.mini).tint(.secondary)
                            .accessibilityLabel("正在补充说明")
                    }
                }
                if !model.elaboration.text.isEmpty {
                    AnnotationMarkdownText(content: model.elaboration.text, size: bodyBaseSize, language: language, blockFormatting: true)
                        .foregroundStyle(LeximoryPalette.ink)
                }
                if case .failed(let message, _) = model.elaboration {
                    Text(message).interfaceFont(13).foregroundStyle(.secondary)
                    Button("重试", systemImage: "arrow.clockwise") {
                        if let client { model.elaborate(client: client, source: item.source) }
                    }.interfaceFont(14).disabled(sync?.online == false)
                }
            }
            .padding(.top, 4)
            .accessibilityIdentifier("definition-elaboration")
        }
    }
    private var actionMotion: Animation? {
        reduceMotion ? nil : .easeOut(duration: 0.18)
    }
    @ViewBuilder private var saveFailure: some View {
        if let error = model.saveError ?? model.editor?.error {
            Text(error).interfaceFont(13).foregroundStyle(LeximoryPalette.muted)
        }
    }
    private var primarySymbolTransition: AnyTransition {
        reduceMotion ? .identity : .opacity
    }
    private var saveSymbol: String {
        switch model.saveState {
        case .idle: "book.closed"
        case .queued, .saving: "book.closed"
        case .saved: saveAcknowledged ? "pencil" : "checkmark"
        case .uncertain: "exclamationmark"
        }
    }
    private var saveLabel: String {
        switch model.saveState {
        case .idle: "收藏词汇"
        case .queued, .saving: "正在收藏"
        case .saved: saveAcknowledged ? "编辑词汇" : "已收藏"
        case .uncertain: "收藏结果待确认"
        }
    }
    private var saveLocked: Bool {
        switch model.saveState {
        case .idle: !model.isReady && !model.isGenerating
        case .queued, .saving, .uncertain: true
        case .saved: !saveAcknowledged
        }
    }
    private func section(_ title: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).interfaceFont(14).foregroundStyle(.secondary)
            AnnotationMarkdownText(content: content, size: bodyBaseSize, language: language)
                .foregroundStyle(LeximoryPalette.ink)
        }
    }

}

struct DefinitionPrimaryButtonStyle: ButtonStyle {
    let reduceMotion: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(LeximoryPalette.paper)
            .background(LeximoryPalette.ink, in: Circle())
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.96 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

private struct DefinitionGlassSurface: ViewModifier {
    var enabled = true
    @ViewBuilder func body(content: Content) -> some View {
        if enabled {
            content
                .clipShape(RoundedRectangle(cornerRadius: 36, style: .continuous))
                .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 36, style: .continuous))
        } else { content }
    }
}

struct DefinitionGlassBackground: View {
    var body: some View { Color.clear.modifier(DefinitionGlassSurface()) }
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
    @State private var atScrollBottom = true
    @GestureState private var startedAtScrollBottom: Bool?
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
                               trayDragging: dragging, onScrollPermission: { atScrollBottom = $0 },
                               allowsFeedback: presented && dismissal == nil && !dragging)
                    .frame(width: min(LeximoryLayout.annotationMeasure, geometry.size.width - 24))
                    .modifier(DefinitionGlassSurface())
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
            .updating($startedAtScrollBottom) { _, atBottom, _ in
                // Reaching the bottom mid-swipe must not turn a scroll into dismissal.
                if atBottom == nil { atBottom = atScrollBottom }
            }
            .onChanged { value in
                let distance = value.translation.height
                guard dismissal == nil,
                      dragging || ((startedAtScrollBottom ?? atScrollBottom) && distance < 0 && abs(distance) > abs(value.translation.width)) else { return }
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
