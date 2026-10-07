import SwiftUI
import WebKit
import PDFKit
import LeximoryCore

struct EbookChapter: Identifiable {
    let title: String
    let location: String
    var depth = 0
    var id: String { location }
}

@MainActor @Observable final class EbookReaderState {
    var chapters: [EbookChapter] = []
    var bookmarks: [EbookBookmark] = []
    var location: String?
    var chapter: String?
    var chapterPage = 1
    var chapterPages = 0
    var selectionLocation: String?
    var selection: EbookSelection?
    var menuSelection: EbookSelection?
    var selectionAction: EbookSelectionAction?
    var chromeVisible = false
    var backRequest: UUID?
    var canBookmark = false
    private var nextPendingBookmarkID = -1
    var bookmarkNotice: UUID?
    var pageBounds: CGRect?
    var readOnly = false
    var rightToLeft = false
    var command: (id: UUID, action: String, value: String?)?
    var loadFailure: String?
    var ready = false
    var totalPages = 0
    var atStart = true
    var atEnd = false
    func beginBookmark(_ selection: EbookSelection) -> EbookBookmark {
        let bookmark = EbookBookmark(id: nextPendingBookmarkID, quote: selection.quote, chapter: chapter, location: selection.location ?? location)
        nextPendingBookmarkID -= 1
        bookmarks.append(bookmark)
        self.selection = nil; menuSelection = nil
        return bookmark
    }
    func finishBookmark(_ pending: EbookBookmark, saved: EbookBookmark?) {
        guard let index = bookmarks.firstIndex(where: { $0.id == pending.id }) else { return }
        if let saved { bookmarks[index] = saved }
        else { bookmarks.remove(at: index); bookmarkNotice = UUID() }
    }
    func gutterSide(at point: CGPoint) -> Bool? {
        guard let pageBounds, point.y >= pageBounds.minY, point.y <= pageBounds.maxY else { return nil }
        if point.x < pageBounds.minX { return false }
        if point.x > pageBounds.maxX { return true }
        return nil
    }
    func navigate(_ action: String, value: String? = nil) {
        selection = nil
        menuSelection = nil
        command = (UUID(), action, value)
    }
}

private enum EbookTray: String, Identifiable {
    case contents, bookmarks, settings
    var id: String { rawValue }
}

struct EbookScreen: View {
    let article: FixtureArticle
    let client: MobileClient?
    var language = "English"
    @State private var reader = EbookReaderState()
    @State private var data: Data?
    @State private var format = "epub"
    @State private var loading = true
    @State private var loadError: String?
    @State private var tray: EbookTray?
    @State private var definition: DefinitionPresentation?
    @State private var positionTask: Task<Void, Never>?
    @State private var scrubPosition: Double?
    @AppStorage("ebook.prose.size") private var fontSize = 18.0
    @AppStorage("ebook.prose.leading") private var lineHeight = 1.6
    @AppStorage("ebook.japanese.prose.size") private var japaneseFontSize = 24.0
    @AppStorage("ebook.japanese.prose.leading") private var japaneseLineHeight = 1.7
    private var proseSize: Binding<Double> { language == "Japanese" ? $japaneseFontSize : $fontSize }
    private var proseLeading: Binding<Double> { language == "Japanese" ? $japaneseLineHeight : $lineHeight }
    @Environment(\.nativeSync) private var sync
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        ZStack {
            if let data {
                if format == "pdf" { NativePDFReader(data: data, reader: reader, command: reader.command).padding(.top, 60).padding(.bottom, 36).padding(.horizontal, 12).frame(maxWidth: 980) }
                else { NativeEPUBReader(data: data, language: language, reader: reader, command: reader.command, fontSize: proseSize.wrappedValue + (language != "Japanese" && sizeClass == .regular ? 2 : 0), lineHeight: proseLeading.wrappedValue, appearance: .automatic).ignoresSafeArea(.container, edges: [.top, .bottom]) }
            }
            if loading { ReadingLoadingIndicator("正在打开电子书……").frame(maxWidth: .infinity, maxHeight: .infinity).background(LeximoryPalette.paper) }
            if let loadError {
                LeximoryUnavailableView("暂时无法打开电子书", systemImage: "book.closed", message: loadError) { Button("重试") { Task { await load() } } }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(LeximoryPalette.paper.ignoresSafeArea())
        .toolbar(.hidden, for: .tabBar)
        .toolbar(.hidden, for: .navigationBar)
        .overlay(alignment: .top) {
            ZStack {
                runningTitle
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 64)
                    .opacity(reader.chromeVisible ? 0 : 1)
                    .accessibilityHidden(reader.chromeVisible)
                    .allowsHitTesting(false)
                if reader.chromeVisible { topControls.transition(.opacity) }
            }.frame(height: 44).padding(.top, 8)
        }
        .overlay(alignment: .bottom) {
            if reader.chromeVisible { bottomControls.transition(.opacity) }
            else { pageLabel.padding(.top, 8).padding(.bottom, 0).allowsHitTesting(false) }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: reader.chromeVisible)
        .overlay(alignment: .top) {
            if let item = definition {
                DefinitionTopTray(item: item, client: client, language: language) { definition = nil }
                    .id(item.id)
            }
        }
        .overlay(alignment: .top) {
            if reader.bookmarkNotice != nil {
                Text("书签未能保存，请重试。")
                    .font(.callout).padding(.horizontal, 20).padding(.vertical, 12)
                    .background(.regularMaterial, in: Capsule())
                    .padding(.top, 60).padding(.horizontal, 20)
                    .allowsHitTesting(false)
                    .accessibilityIdentifier("ebook-bookmark-error")
            }
        }
        .sensoryFeedback(.error, trigger: reader.bookmarkNotice)
        .task(id: reader.bookmarkNotice) {
            guard reader.bookmarkNotice != nil else { return }
            UIAccessibility.post(notification: .announcement, argument: "书签未能保存，请重试。")
            do { try await Task.sleep(for: .seconds(4)); reader.bookmarkNotice = nil } catch {}
        }
        .accessibilityAction(named: reader.chromeVisible ? "隐藏阅读工具" : "显示阅读工具") { reader.chromeVisible.toggle() }
        .accessibilityScrollAction { edge in
            if edge == .trailing { reader.navigate(reader.rightToLeft ? "previous" : "next") }
            if edge == .leading { reader.navigate(reader.rightToLeft ? "next" : "previous") }
        }
        .onChange(of: sync?.online) { _, _ in reader.readOnly = sync?.online == false || ProcessInfo.processInfo.arguments.contains("--ebook-read-only") }
        .onChange(of: reader.backRequest) { _, _ in dismiss() }
        .onDisappear { positionTask?.cancel() }
        .onChange(of: reader.selectionAction?.id) { _, _ in
            guard let action = reader.selectionAction else { return }
            if action.kind == .define {
                definition = DefinitionPresentation(source: .ebook(textID: article.id.rawValue, quote: action.selection.quote, context: action.selection.context, offset: action.selection.offset), definition: nil)
            } else { Task { await saveBookmark(action.selection) } }
        }
        .task(id: article.id) { await load() }
        .onChange(of: reader.loadFailure) { _, failure in if let failure { loading = false; loadError = failure } }
        .onChange(of: reader.ready) { _, ready in if ready { loading = false } }
        .onChange(of: reader.location) { previous, location in
            guard !reader.readOnly, reader.ready, previous != location, let location, let client else { return }
            positionTask?.cancel()
            positionTask = Task {
                do {
                    try await Task.sleep(for: .milliseconds(750))
                    try await client.saveEbookPosition(textID: article.id.rawValue, location: location)
                } catch { /* Reading-position sync never interrupts reading. */ }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("ebook-reader")
        .accessibilityValue(reader.ready ? format == "epub" ? "epub已打开，\(reader.chapter ?? "")，章节第\(reader.chapterPage)页" : "pdf已打开" : "正在打开")
    }
    private var contentsTray: some View {
            NavigationStack {
                List {
                    Section {
                        ForEach(reader.chapters) { chapter in
                            Button { reader.navigate("display", value: chapter.location); tray = nil } label: {
                                Text(chapter.title).foregroundStyle(LeximoryPalette.ink)
                                    .padding(.leading, CGFloat(chapter.depth) * 16)
                            }
                        }
                    }
                }.listStyle(.plain)
                    .scrollContentBackground(.hidden).background(LeximoryPalette.paper)
                    .listRowBackground(LeximoryPalette.paper)
                    .navigationTitle("目录").navigationBarTitleDisplayMode(.inline)
            }.frame(minWidth: sizeClass == .regular ? 360 : nil, idealHeight: min(540, CGFloat(reader.chapters.count) * 48 + 100))
                .presentationCompactAdaptation(.sheet).presentationDetents([.medium, .large])
                .presentationBackground(LeximoryPalette.paper)
    }
    private var bookmarksTray: some View {
        NavigationStack {
            List(reader.bookmarks) { bookmark in
                Button {
                    if let location = bookmark.location { reader.navigate("display", value: location); tray = nil }
                } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(bookmark.quote).font(LeximoryTypography.prose(16, language: language)).lineLimit(4)
                        if format == "pdf", let location = bookmark.location {
                            Text("第\(location)页").font(.caption).foregroundStyle(.secondary)
                        } else if let chapter = bookmark.chapter, !chapter.isEmpty {
                            Text(chapter).font(.caption).foregroundStyle(.secondary)
                        }
                    }.foregroundStyle(LeximoryPalette.ink)
                }.disabled(bookmark.location?.isEmpty != false)
                    .listRowBackground(LeximoryPalette.paper)
            }.listStyle(.plain).scrollContentBackground(.hidden)
                .background(LeximoryPalette.paper)
                .overlay { if reader.bookmarks.isEmpty { ContentUnavailableView("暂无书签", systemImage: "bookmark") } }
                .navigationTitle("书签").navigationBarTitleDisplayMode(.inline)
        }.frame(minWidth: sizeClass == .regular ? 360 : nil, idealHeight: min(540, max(240, CGFloat(reader.bookmarks.count) * 88 + 80)))
            .presentationCompactAdaptation(.sheet).presentationDetents([.medium, .large])
            .presentationBackground(LeximoryPalette.paper)
    }
    private var topControls: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left").font(.system(size: 16))
                    .frame(width: 36, height: 36)
                    .glassEffect(.regular.interactive(), in: Circle())
                    .frame(width: 44, height: 44).contentShape(Rectangle())
            }.accessibilityLabel("返回")
            Spacer(minLength: 0)
            readerActions
        }.buttonStyle(.plain).foregroundStyle(LeximoryPalette.ink)
            .padding(.horizontal, 20)
    }
    private var readerActions: some View {
        HStack(spacing: 0) {
            Button { tray = .contents } label: {
                Image(systemName: "list.bullet").frame(width: 44, height: 44).contentShape(Rectangle())
            }.accessibilityLabel("目录").accessibilityIdentifier("ebook-contents").disabled(!reader.ready)
            Button { tray = .bookmarks } label: {
                Image(systemName: "bookmark").frame(width: 44, height: 44).contentShape(Rectangle())
            }.accessibilityLabel("书签").accessibilityIdentifier("ebook-bookmarks").disabled(!reader.ready)
            Button { tray = .settings } label: {
                Image(systemName: "slider.horizontal.3").font(.system(size: 18))
                    .frame(width: 44, height: 44).contentShape(Rectangle())
            }.accessibilityLabel("阅读选项").accessibilityIdentifier("ebook-settings").disabled(!reader.ready)
            if let client {
                ShareLink(item: client.webURL.appending(path: "read/\(article.id.rawValue)")) {
                    Image(systemName: "square.and.arrow.up")
                        .frame(width: 44, height: 44).contentShape(Rectangle())
                }.accessibilityLabel("分享")
            }
        }.frame(height: 36).padding(.horizontal, 4)
            .glassEffect(.regular.interactive(), in: Capsule())
            .popover(item: $tray) { tray in
            switch tray {
            case .contents: contentsTray
            case .bookmarks: bookmarksTray
            case .settings: readingSettings.presentationCompactAdaptation(.sheet)
            }
        }
    }
    private var bottomControls: some View {
        VStack(spacing: 6) {
            if format != "pdf", reader.totalPages > 0 {
                Slider(value: Binding(get: { scrubPosition ?? Double(reader.location ?? "1") ?? 1 }, set: { scrubPosition = $0 }), in: 1...Double(max(2, reader.totalPages)), step: 1) { editing in
                    if !editing, let position = scrubPosition { reader.navigate("display", value: String(Int(position))); scrubPosition = nil }
                }.accessibilityLabel("阅读进度")
                    .accessibilityValue("第\(Int(scrubPosition ?? Double(reader.location ?? "1") ?? 1))页，共\(reader.totalPages)页")
                    .disabled(reader.totalPages < 2)
            }
            pageLabel
        }.padding(.horizontal, 28).padding(.top, 8).padding(.bottom, 0).frame(maxWidth: 540).tint(LeximoryPalette.muted)
    }
    private var runningTitle: some View {
        Text(article.title).editorialFont(18, language: language)
            .foregroundStyle(LeximoryPalette.muted).lineLimit(1)
            .accessibilityIdentifier("ebook-running-title")
    }
    private var pageLabel: some View {
        Text(reader.totalPages > 0 ? "\(reader.location ?? "1") / \(reader.totalPages)" : reader.chapterPages > 0 ? "\(reader.chapterPage) / \(reader.chapterPages)" : "\(reader.chapterPage)")
            .font(LeximoryTypography.interface(15)).foregroundStyle(LeximoryPalette.muted)
            .lineLimit(1).padding(.top, 8).padding(.bottom, 0).opacity(reader.ready ? 1 : 0)
            .accessibilityIdentifier("ebook-page-position")
            .accessibilityLabel("阅读位置")
            .accessibilityValue(reader.totalPages > 0 ? "第\(reader.location ?? "1")页，共\(reader.totalPages)页" : "\(reader.chapter ?? article.title)，章节第\(reader.chapterPage)页，共\(reader.chapterPages)页")
    }

    private var readingSettings: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    if format == "epub" {
                        VStack(alignment: .leading, spacing: 12) { Text("字号"); Slider(value: proseSize, in: 16...30, step: 1).accessibilityLabel("字号") }
                        VStack(alignment: .leading, spacing: 12) { Text("行距"); Slider(value: proseLeading, in: 1.5...2.2, step: 0.1).accessibilityLabel("行距") }
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("缩放").font(LeximoryTypography.interface(14)).foregroundStyle(LeximoryPalette.muted)
                            Button { reader.navigate("fit"); tray = nil } label: {
                                Label("适合页面", systemImage: "arrow.up.left.and.arrow.down.right")
                                    .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                                    .contentShape(Rectangle())
                            }
                            Divider()
                            Button { reader.navigate("width"); tray = nil } label: {
                                Label("适合宽度", systemImage: "arrow.left.and.right")
                                    .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                                    .contentShape(Rectangle())
                            }
                        }.buttonStyle(.plain).tint(LeximoryPalette.ink)
                    }
                }.font(LeximoryTypography.interface(17)).foregroundStyle(LeximoryPalette.ink)
                    .padding(24).frame(maxWidth: .infinity, alignment: .leading)
            }.background(LeximoryPalette.paper)
                .navigationTitle("阅读选项").navigationBarTitleDisplayMode(.inline)
        }.frame(minWidth: sizeClass == .regular ? 340 : nil, idealHeight: format == "epub" ? 280 : 260)
            .presentationDetents([.medium]).presentationDragIndicator(.visible)
            .presentationBackground(LeximoryPalette.paper).tint(LeximoryPalette.ink)
    }
    private func load() async {
        reader.canBookmark = client != nil
        reader.readOnly = sync?.online == false || ProcessInfo.processInfo.arguments.contains("--ebook-read-only")
        reader.rightToLeft = language == "Japanese"
        loading = true; loadError = nil; reader.ready = false; reader.loadFailure = nil; data = nil
        do {
            if let client {
                let book: LocalEbook
                if let cached = await client.cachedEbook(textID: article.id.rawValue) { book = cached }
                else {
                    guard sync?.online != false else { throw URLError(.notConnectedToInternet) }
                    book = try await client.downloadEbook(textID: article.id.rawValue)
                }
                try Task.checkCancellation()
                reader.location = book.location; reader.bookmarks = book.descriptor.bookmarks
                format = book.descriptor.format; data = book.data
            } else {
                format = article.resource.hasSuffix("pdf") ? "pdf" : "epub"
                #if DEBUG
                if language == "Japanese", let path = ProcessInfo.processInfo.environment["LEXIMORY_EXAMPLE_EPUB"] {
                    data = try Data(contentsOf: URL(fileURLWithPath: path))
                } else {
                    guard let url = Bundle.main.url(forResource: article.resource, withExtension: nil) else { throw CocoaError(.fileNoSuchFile) }
                    data = try Data(contentsOf: url)
                }
                #else
                guard let url = Bundle.main.url(forResource: article.resource, withExtension: nil) else { throw CocoaError(.fileNoSuchFile) }
                data = try Data(contentsOf: url)
                #endif
            }
        } catch {
            if !Task.isCancelled {
                loading = false; loadError = sync?.online == false ? "无法打开电子书，请连接网络后重试。" : "请检查网络后重试。"
            }
        }
    }
    private func saveBookmark(_ selection: EbookSelection) async {
        guard !reader.readOnly, let client else { return }
        let pending = reader.beginBookmark(selection)
        do {
            let bookmark = try await client.saveEbookBookmark(textID: article.id.rawValue, quote: pending.quote, chapter: pending.chapter, location: pending.location)
            reader.finishBookmark(pending, saved: bookmark)
        } catch { reader.finishBookmark(pending, saved: nil) }
    }
}

private struct NativeEPUBReader: UIViewRepresentable {
    let data: Data
    let language: String
    let reader: EbookReaderState
    let command: (id: UUID, action: String, value: String?)?
    let fontSize: Double
    let lineHeight: Double
    let appearance: EbookAppearance
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dynamicTypeSize) private var typeSize
    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.userContentController.add(context.coordinator, name: "reader")
        let web = LearningWebView(frame: .zero, configuration: config)
        web.reader = reader
        context.coordinator.pageTurn = EPUBPageTurn(web: web, reader: reader)
        context.coordinator.web = web
        context.coordinator.gestures.install(on: web, centerTap: true)
        web.navigationDelegate = context.coordinator
        #if DEBUG
        web.isInspectable = true
        #endif
        web.isOpaque = false; web.backgroundColor = LeximoryPalette.paperUI
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        guard let url = Bundle.main.url(forResource: "ebook-reader", withExtension: "html") else { return web }
        web.loadFileURL(url, allowingReadAccessTo: Bundle.main.bundleURL)
        return web
    }
    func updateUIView(_ web: WKWebView, context: Context) {
        context.coordinator.parent = self
        let theme = context.coordinator.theme(web)
        if reader.ready, theme != context.coordinator.appliedTheme {
            context.coordinator.appliedTheme = theme
            context.coordinator.pageTurn?.invalidateSnapshot()
            Task { _ = try? await web.callAsyncJavaScript("await window.readerTheme(theme)", arguments: ["theme": theme], in: nil, contentWorld: .page) }
        }
        let bookmarks = reader.bookmarks.map { $0.quote }
        if reader.ready, bookmarks != context.coordinator.appliedBookmarks {
            context.coordinator.appliedBookmarks = bookmarks
            context.coordinator.pageTurn?.invalidateSnapshot()
            Task { _ = try? await web.callAsyncJavaScript("window.readerBookmarks(quotes)", arguments: ["quotes": bookmarks], in: nil, contentWorld: .page) }
        }
        if let command, command.id != context.coordinator.commandID {
            context.coordinator.commandID = command.id
            Task { _ = try? await web.callAsyncJavaScript("window.readerCommand(action, value)", arguments: ["action": command.action, "value": command.value ?? ""], in: nil, contentWorld: .page) }
        }
    }
    static func dismantleUIView(_ web: WKWebView, coordinator: Coordinator) {
        coordinator.pageTurn?.stop()
        web.configuration.userContentController.removeScriptMessageHandler(forName: "reader")
        web.navigationDelegate = nil
    }
    @MainActor final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        var parent: NativeEPUBReader
        var commandID: UUID?
        var appliedTheme: [String: String] = [:]
        var appliedBookmarks: [String] = []
        weak var web: WKWebView?
        var pageTurn: EPUBPageTurn?
        let gestures: EbookGestures
        init(_ parent: NativeEPUBReader) { self.parent = parent; gestures = EbookGestures(reader: parent.reader) }
        func theme(_ web: WKWebView) -> [String: String] {
            let colors = parent.appearance.colors(dark: parent.scheme == .dark, softerInk: parent.language == "Chinese" || parent.language == "Japanese")
            if let rgb = UInt32(colors.paper.dropFirst(), radix: 16) {
                web.backgroundColor = UIColor(red: CGFloat((rgb >> 16) & 255) / 255,
                                              green: CGFloat((rgb >> 8) & 255) / 255,
                                              blue: CGFloat(rgb & 255) / 255, alpha: 1)
            }
            let size = UIFontMetrics(forTextStyle: .body).scaledValue(for: parent.fontSize, compatibleWith: web.traitCollection)
            // The paper runs edge to edge, so the prose keeps its own top and
            // bottom margins clear of the running title and page label.
            let safeTop = web.window?.safeAreaInsets.top ?? 0
            let safeBottom = web.window?.safeAreaInsets.bottom ?? 0
            return ["paper": colors.paper, "ink": colors.ink, "size": String(Double(size)), "leading": String(parent.lineHeight), "weight": "400", "writing": parent.language == "Japanese" ? "vertical-rl" : "horizontal-tb", "top": String(Double(safeTop) + 56), "bottom": String(Double(safeBottom) + 24)]
        }
        func webView(_ web: WKWebView, didFinish navigation: WKNavigation!) {
            let cjk = parent.language == "Chinese" || parent.language == "Japanese"
            let font = parent.language == "Japanese" ? "ChillDuanHeiSongProJP_Regular" : cjk ? "ChillDuanHeiSongPro_Regular" : "LibreBaskerville"
            let fontExtension = cjk ? "otf" : "ttf"
            let fontData = Bundle.main.url(forResource: font, withExtension: fontExtension).flatMap { try? Data(contentsOf: $0) } ?? Data()
            let italicData = Bundle.main.url(forResource: "LibreBaskerville-Italic", withExtension: "ttf").flatMap { try? Data(contentsOf: $0) } ?? Data()
            let bookmarks = parent.reader.bookmarks.map { ["location": $0.location ?? "", "quote": $0.quote] }
            let theme = theme(web)
            appliedTheme = theme
            let displayFont = cjk ? font : "EBGaramond"
            let displayData = Bundle.main.url(forResource: displayFont, withExtension: fontExtension).flatMap { try? Data(contentsOf: $0) } ?? Data()
            Task { do {
            _ = try await web.callAsyncJavaScript("await window.openBook(bytes, location, fonts, theme, bookmarks)", arguments: [
                "bytes": parent.data.base64EncodedString(), "location": parent.reader.location ?? "",
                "fonts": ["regular": "data:font/\(fontExtension);base64," + fontData.base64EncodedString(), "italic": "data:font/ttf;base64," + italicData.base64EncodedString(), "display": "data:font/\(fontExtension);base64," + displayData.base64EncodedString()],
                "theme": theme, "bookmarks": bookmarks
            ], in: nil, contentWorld: .page)
            } catch { parent.reader.loadFailure = "电子书未能加载，请重试。" } }

        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            let scheme = navigationAction.request.url?.scheme
            return ["file", "blob", "about", "data"].contains(scheme ?? "") ? .allow : .cancel
        }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let kind = body["kind"] as? String else { return }
            switch kind {
            case "diagnostic":
                #if DEBUG
                NSLog("EPUB bridge: %@", body["message"] as? String ?? "")
                #endif
            case "layout":
                if let x = body["x"] as? Double, let y = body["y"] as? Double,
                   let width = body["width"] as? Double, let height = body["height"] as? Double {
                    parent.reader.pageBounds = CGRect(x: x, y: y, width: width, height: height)
                }
            case "ready":
                Task { [weak self] in
                    guard let self else { return }
                    await self.pageTurn?.prime()
                    self.parent.reader.ready = true
                    self.web?.becomeFirstResponder()
                }
            case "failed": parent.reader.loadFailure = "电子书未能加载，请重试。"
            case "contents":
                parent.reader.chapters = (body["items"] as? [[String: Any]] ?? []).compactMap { item in
                    guard let title = item["title"] as? String, let href = item["href"] as? String else { return nil }
                    return EbookChapter(title: title, location: href, depth: item["depth"] as? Int ?? 0)
                }
            case "selected":
                guard let quote = body["quote"] as? String, let context = body["context"] as? String, let offset = body["offset"] as? Int else { return }
                let anchor = body["rect"] as? [String: Double] ?? [:]
                parent.reader.selection = EbookSelection(quote: quote, context: context, offset: offset, location: parent.reader.selectionLocation,
                    rect: web?.convert(CGRect(x: anchor["x"] ?? 0, y: anchor["y"] ?? 0, width: anchor["width"] ?? 1, height: anchor["height"] ?? 1), to: nil) ?? .zero)
                parent.reader.menuSelection = parent.reader.selection
            case "selectionLocation":
                parent.reader.selectionLocation = body["location"] as? String
                parent.reader.selection?.location = parent.reader.selectionLocation
                parent.reader.menuSelection?.location = parent.reader.selectionLocation
            case "selectionCleared": parent.reader.selection = nil; parent.reader.selectionLocation = nil
            case "location":
                parent.reader.location = body["location"] as? String
                parent.reader.chapterPage = body["page"] as? Int ?? 1
                parent.reader.chapterPages = body["pages"] as? Int ?? 0
                parent.reader.chapter = body["chapter"] as? String
                parent.reader.atStart = body["atStart"] as? Bool ?? false
                parent.reader.atEnd = body["atEnd"] as? Bool ?? false
                pageTurn?.pageArrived()
            default: break
            }
        }
    }
}

private struct NativePDFReader: UIViewRepresentable {
    let data: Data
    let reader: EbookReaderState
    let command: (id: UUID, action: String, value: String?)?
    func makeCoordinator() -> Coordinator { Coordinator(reader: reader) }
    func makeUIView(context: Context) -> PDFView {
        let view = LearningPDFView()
        view.reader = reader
        context.coordinator.gestures.install(on: view, centerTap: true)
        view.backgroundColor = LeximoryPalette.paperUI
        view.autoScales = true; view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        view.displaysPageBreaks = true; view.pageBreakMargins = UIEdgeInsets(top: 8, left: 0, bottom: 8, right: 0); view.pageShadowsEnabled = false
        view.usePageViewController(false)
        guard let document = PDFDocument(data: data), document.pageCount > 0 else {
            Task { reader.loadFailure = "电子书未能加载，请重试。" }
            return view
        }
        view.document = document
        reader.totalPages = document.pageCount
        if let page = Int(reader.location ?? ""), let target = view.document?.page(at: max(0, page - 1)) { view.go(to: target) }
        if let document = view.document {
            func chapters(_ outline: PDFOutline, depth: Int = 0) -> [EbookChapter] {
                (0..<outline.numberOfChildren).flatMap { index -> [EbookChapter] in
                    guard let child = outline.child(at: index) else { return [] }
                    let own: [EbookChapter]
                    if let title = child.label, let page = child.destination?.page {
                        own = [EbookChapter(title: title, location: String(document.index(for: page) + 1), depth: depth)]
                    } else { own = [] }
                    return own + chapters(child, depth: depth + 1)
                }
            }
            reader.chapters = document.outlineRoot.map { chapters($0) } ?? []
            if reader.chapters.isEmpty { reader.chapters = (0..<document.pageCount).map { EbookChapter(title: "\($0 + 1)", location: "\($0 + 1)") } }

        }
        context.coordinator.observe(view)
        Task { context.coordinator.pageChanged(); reader.ready = true }
        return view
    }
    func updateUIView(_ view: PDFView, context: Context) {
        context.coordinator.updateBookmarks(in: view)
        if let command, command.id != context.coordinator.commandID {
            context.coordinator.commandID = command.id
            switch command.action {
            case "next": view.goToNextPage(nil)
            case "previous": view.goToPreviousPage(nil)
            case "display": if let index = Int(command.value ?? ""), let page = view.document?.page(at: index - 1) { view.go(to: page) }
            case "fit": view.scaleFactor = view.scaleFactorForSizeToFit
            case "width":
                if let page = view.currentPage { view.scaleFactor = view.bounds.width / max(1, page.bounds(for: view.displayBox).width) }
            default: break
            }
        }
    }
    @MainActor final class Coordinator: NSObject {
        let reader: EbookReaderState
        var commandID: UUID?
        private var appliedBookmarkIDs: [Int] = []
        private var bookmarkAnnotations: [(PDFPage, PDFAnnotation)] = []
        func updateBookmarks(in view: PDFView) {
            let ids = reader.bookmarks.map(\.id)
            guard ids != appliedBookmarkIDs, let document = view.document else { return }
            appliedBookmarkIDs = ids
            for (page, annotation) in bookmarkAnnotations { page.removeAnnotation(annotation) }
            bookmarkAnnotations.removeAll()
            for bookmark in reader.bookmarks {
                guard let number = Int(bookmark.location ?? ""), let target = document.page(at: number - 1),
                      let text = target.string, let range = text.range(of: bookmark.quote),
                      let selection = target.selection(for: NSRange(range, in: text)) else { continue }
                for line in selection.selectionsByLine() {
                    for page in line.pages {
                        let annotation = PDFAnnotation(bounds: line.bounds(for: page), forType: .highlight, withProperties: nil)
                        annotation.color = UIColor(LeximoryPalette.illustration).withAlphaComponent(0.3)
                        page.addAnnotation(annotation)
                        bookmarkAnnotations.append((page, annotation))
                    }
                }
            }
        }
        weak var view: PDFView?
        let gestures: EbookGestures
        init(reader: EbookReaderState) { self.reader = reader; gestures = EbookGestures(reader: reader) }
        func observe(_ view: PDFView) {
            self.view = view
            NotificationCenter.default.addObserver(self, selector: #selector(pageChanged), name: .PDFViewPageChanged, object: view)
            NotificationCenter.default.addObserver(self, selector: #selector(selectionChanged), name: .PDFViewSelectionChanged, object: view)
        }
        @objc func pageChanged() {
            guard let document = view?.document, let page = view?.currentPage else { return }
            let index = document.index(for: page)
            reader.location = String(index + 1); reader.chapter = page.label ?? String(index + 1)
            reader.atStart = index == 0; reader.atEnd = index == document.pageCount - 1
        }
        @objc func selectionChanged() {
            guard let selection = view?.currentSelection, let quote = selection.string?.trimmingCharacters(in: .whitespacesAndNewlines), !quote.isEmpty, quote.count <= 1024 else { reader.selection = nil; return }
            guard let selectedPage = selection.pages.first, let pageText = selectedPage.string,
                  selection.numberOfTextRanges(on: selectedPage) > 0 else { reader.selection = nil; return }
            let selectedRange = selection.range(at: 0, on: selectedPage)
            let text = pageText as NSString
            guard selectedRange.location != NSNotFound, NSMaxRange(selectedRange) <= text.length else { reader.selection = nil; return }
            let start = max(0, selectedRange.location - 1400)
            let end = min(text.length, NSMaxRange(selectedRange) + 1400)
            let context = text.substring(with: NSRange(location: start, length: end - start))
            let offset = selectedRange.location - start
            if offset + (quote as NSString).length <= (context as NSString).length, (context as NSString).substring(with: NSRange(location: offset, length: (quote as NSString).length)) == quote {
                reader.selection = EbookSelection(quote: quote, context: context, offset: offset, location: String((view?.document?.index(for: selectedPage) ?? 0) + 1), rect: view.map { $0.convert($0.convert(selection.bounds(for: selectedPage), from: selectedPage), to: nil) } ?? .zero)
            } else { reader.selection = EbookSelection(quote: quote, context: quote, offset: 0, location: String((view?.document?.index(for: selectedPage) ?? 0) + 1), rect: view.map { $0.convert($0.convert(selection.bounds(for: selectedPage), from: selectedPage), to: nil) } ?? .zero) }
            reader.menuSelection = reader.selection
        }
        deinit { NotificationCenter.default.removeObserver(self) }
    }
}
