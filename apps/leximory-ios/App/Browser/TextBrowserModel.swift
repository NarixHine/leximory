import SwiftUI
import WebKit
import QuartzCore
import LeximoryCore

enum BrowserSearchEngine: String, CaseIterable, Identifiable {
    case bing, google, duckDuckGo, baidu
    static func selected(in defaults: UserDefaults = .standard) -> Self {
        defaults.string(forKey: "browser.searchEngine").flatMap(Self.init(rawValue:)) ?? .bing
    }
    var id: String { rawValue }
    var name: String {
        switch self { case .bing: "Bing"; case .google: "Google"; case .duckDuckGo: "DuckDuckGo"; case .baidu: "百度" }
    }
    var endpoint: String {
        switch self {
        case .bing: "https://www.bing.com/search"
        case .google: "https://www.google.com/search"
        case .duckDuckGo: "https://duckduckgo.com/"
        case .baidu: "https://www.baidu.com/s"
        }
    }
    var queryParameter: String { self == .baidu ? "wd" : "q" }
}
import os

struct BrowserSelection: Decodable {
    let quote: String
    let context: String
    let offset: Int
    let url: String
}

final class BrowserWebView: WKWebView {
    var lookup: ((BrowserSelection) -> Void)?
    var search: ((String) -> Void)?
    private var selectionRequest = UUID()
    func invalidateSelection() { selectionRequest = UUID(); ReadingGlassMenu.dismiss(from: self) }
    private static let world = WKContentWorld.world(name: "LeximoryBrowserSelection")
    static let selectionScript = """
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
        const range = selection.getRangeAt(0);
        const element = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
        if (!element || element.closest('input,textarea,[contenteditable]:not([contenteditable="false"]),script,style')) return null;
        const excluded = 'rt,rp,script,style,input,textarea,[contenteditable]:not([contenteditable="false"])';
        const block = element.closest('p,li,blockquote,h1,h2,h3,h4,h5,h6,td,pre') || element;
        if (!block.contains(range.endContainer)) return null;
        const outside = (node, forward) => {
          while (node && node !== block) {
            const sibling = forward ? node.nextSibling : node.previousSibling;
            if (sibling) return sibling;
            node = node.parentNode;
          }
          return null;
        };
        // Walk from the selection boundaries. Never clone a paragraph or read its
        // complete text just to keep 1,200 characters of surrounding context.
        const read = (container, offset, forward, limit, selected = false) => {
          let node = container, result = '', visits = 0;
          if (node.nodeType !== Node.TEXT_NODE) {
            node = node.childNodes[forward ? offset : offset - 1] || outside(node, forward);
            offset = null;
          }
          while (node && result.length < limit && visits++ < 4096) {
            if (node.nodeType === Node.TEXT_NODE) {
              if (selected && range.comparePoint(node, 0) > 0) break;
              const start = offset === null ? (forward ? 0 : node.length) : offset;
              const end = selected && node === range.endContainer ? range.endOffset : node.length;
              const available = limit - result.length;
              const part = forward ? node.data.slice(start, Math.min(end, start + available))
                                   : node.data.slice(Math.max(0, start - available), start);
              result = forward ? result + part : part + result;
              if (selected && node === range.endContainer) break;
              node = outside(node, forward);
            } else if (node.nodeType === Node.ELEMENT_NODE && node.matches(excluded)) {
              node = outside(node, forward);
            } else {
              node = (forward ? node.firstChild : node.lastChild) || outside(node, forward);
            }
            offset = null;
          }
          return {text: result, exhausted: visits >= 4096};
        };
        const selected = read(range.startContainer, range.startOffset, true, 1025, true);
        const quote = selected.text;
        if (!quote.trim() || quote.length > 1024 || selected.exhausted) return null;
        const leading = read(range.startContainer, range.startOffset, false, 1200).text;
        const trailing = read(range.endContainer, range.endOffset, true, 1200).text;
        return {quote, context: leading + quote + trailing, offset: leading.length, url: location.href};
        """

    override func buildMenu(with builder: UIMenuBuilder) {
        super.buildMenu(with: builder)
        guard builder.system == .context else { return }
        guard !super.canPerformAction(#selector(UIResponderStandardEditActions.cut(_:)), withSender: nil) else { return }
        ReadingSelectionMenu.removeUnrelatedActions(from: builder)
        // Each menu owns its snapshot. A late response from an older menu cannot
        // replace the selection used by a newer menu or a different document.
        let request = selectionRequest
        var capturedSelection: BrowserSelection?
        capture { [weak self] selection in
            guard self?.selectionRequest == request else { return }
            capturedSelection = selection
        }
        let action = UIAction(title: ReadingSelectionMenu.lookupTitle, image: ReadingSelectionMenu.lookupImage) { [weak self] _ in
            guard let self, selectionRequest == request else { return }
            if let capturedSelection { lookup?(capturedSelection) }
            else {
                capture { [weak self] selection in
                    guard let self, self.selectionRequest == request, let selection else { return }
                    self.lookup?(selection)
                }
            }
        }
        let searchAction = UIAction(title: BrowserSearchEngine.selected().name, image: UIImage(systemName: "magnifyingglass"), identifier: ReadingSelectionMenu.searchIdentifier, attributes: search == nil ? .disabled : []) { [weak self] _ in
            guard let self, selectionRequest == request else { return }
            if let capturedSelection { search?(capturedSelection.quote) }
            else {
                capture { [weak self] selection in
                    guard let self, self.selectionRequest == request, let selection else { return }
                    self.search?(selection.quote)
                }
            }
        }
        ReadingSelectionMenu.insertLearningActions([action], into: builder, trailingActions: [searchAction])
        let elements = builder.menu(for: .root)?.children ?? []
        builder.replaceChildren(ofMenu: .root) { _ in [] }
        Task { @MainActor [weak self] in
            guard let self else { return }
            let script = "const s = getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return null; const r = s.getRangeAt(0).getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height};"
            guard let value = try? await callAsyncJavaScript(script, arguments: [:], in: nil, contentWorld: Self.world) as? [String: Double],
                  selectionRequest == request else { return }
            let scale = scrollView.zoomScale
            let rect = CGRect(x: value["x", default: 0] * scale, y: value["y", default: 0] * scale,
                              width: value["width", default: 0] * scale, height: value["height", default: 0] * scale)
            ReadingGlassMenu.present(from: self, rect: rect, elements: elements)
        }
    }
    private func capture(_ completion: @escaping (BrowserSelection?) -> Void) {
        Task { @MainActor in
            do {
                guard let value = try await callAsyncJavaScript(Self.selectionScript, arguments: [:], in: nil, contentWorld: Self.world),
                      JSONSerialization.isValidJSONObject(value) else {
                    Logger(subsystem: "com.leximory.reader", category: "browser").debug("Selection is outside readable webpage text")
                    completion(nil); return
                }
                let data = try JSONSerialization.data(withJSONObject: value)
                let selection = try JSONDecoder().decode(BrowserSelection.self, from: data)
                completion(selection)
            } catch {
                Logger(subsystem: "com.leximory.reader", category: "browser").error("Selection capture failed: code=\((error as NSError).code)")
                completion(nil)
            }
        }
    }
}

@MainActor @Observable final class TextBrowserModel: NSObject, WKNavigationDelegate, WKUIDelegate {
    static let browsingDataWillClear = Notification.Name("Leximory.browsingDataWillClear")
    @ObservationIgnored let web: BrowserWebView
    @ObservationIgnored let adBlocker: BrowserAdBlocker
    private(set) var canReloadForBlocking = false
    @ObservationIgnored private var blockingLists: [WKContentRuleList] = []
    @ObservationIgnored private var policyRequest = UUID()
    @ObservationIgnored private var pendingReloadSafety = false
    private(set) var url: URL?
    private(set) var title = ""
    private(set) var loading = false
    private(set) var isPDF = false
    private(set) var canGoBack = false
    private(set) var canGoForward = false
    private(set) var navigationID = UUID()
    private(set) var pageColor: UIColor = .systemBackground
    var error: String?
    @ObservationIgnored var committed: ((WKBackForwardListItem) -> Void)?
    @ObservationIgnored var historyGesture: ((URL) -> Bool)?
    @ObservationIgnored var navigationBegan: (() -> Void)?
    @ObservationIgnored private var pendingScroll: (navigation: WKNavigation, offset: CGFloat)?
    @ObservationIgnored private var currentNavigation: WKNavigation?
    @ObservationIgnored private var searchNavigation: WKNavigation?
    @ObservationIgnored private var observations: [NSKeyValueObservation] = []
    @ObservationIgnored private var pdfDownload: BrowserPDFDownload?

    override convenience init() { self.init(websiteDataStore: .default()) }

    init(websiteDataStore: WKWebsiteDataStore, adBlocker: BrowserAdBlocker = .shared) {
        self.adBlocker = adBlocker
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = websiteDataStore
        configuration.defaultWebpagePreferences.preferredContentMode = UIDevice.current.userInterfaceIdiom == .phone ? .mobile : .desktop
        // No app credentials or native message handlers are exposed to websites.
        web = BrowserWebView(frame: .zero, configuration: configuration)
        super.init()
        web.search = { [weak self] query in self?.search(query) }
        web.customUserAgent = Self.safariUserAgent(idiom: UIDevice.current.userInterfaceIdiom)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isFindInteractionEnabled = true
        web.allowsBackForwardNavigationGestures = true
        web.scrollView.contentInset.bottom = 80
        Task { try? await adBlocker.currentPolicy() }
        observations = [
            web.observe(\.url, options: [.new]) { [weak self] _, _ in Task { @MainActor in self?.update() } },
            web.observe(\.title, options: [.new]) { [weak self] _, _ in Task { @MainActor in self?.update() } },
            web.observe(\.isLoading, options: [.new]) { [weak self] _, _ in Task { @MainActor in self?.update() } },
            web.observe(\.canGoBack, options: [.new]) { [weak self] _, _ in Task { @MainActor in self?.update() } },
            web.observe(\.canGoForward, options: [.new]) { [weak self] _, _ in Task { @MainActor in self?.update() } },
            web.observe(\.themeColor, options: [.initial, .new]) { [weak self] _, _ in Task { @MainActor in self?.update() } },
            web.observe(\.underPageBackgroundColor, options: [.initial, .new]) { [weak self] _, _ in Task { @MainActor in self?.update() } },
        ]
    }
    static func address(_ input: String) -> URL? {
        let input = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !input.isEmpty, !input.contains(where: \.isWhitespace),
              let url = URL(string: input.contains("://") ? input : "https://" + input),
              ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
              url.host != nil, url.user == nil, url.password == nil else { return nil }
        return url
    }
    static func destination(_ input: String, engine: BrowserSearchEngine = .bing) -> URL? {
        let input = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !input.isEmpty else { return nil }
        if input.contains("://") { return address(input) }
        if ["javascript:", "data:", "file:", "about:", "http:", "https:"].contains(where: { input.lowercased().hasPrefix($0) }) { return nil }
        if let url = address(input), let host = url.host,
           host.contains(".") || host == "localhost" || host.contains(":") { return url }
        return searchURL(input, engine: engine)
    }
    static func searchURL(_ query: String, engine: BrowserSearchEngine? = nil) -> URL? {
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return nil }
        let engine = engine ?? BrowserSearchEngine.selected()
        var search = URLComponents(string: engine.endpoint)!
        search.queryItems = [URLQueryItem(name: engine.queryParameter, value: query)]
        return search.url
    }
    func search(_ query: String) {
        guard let url = Self.searchURL(query) else { return }
        load(url, animateSearch: true)
    }
    static func safariUserAgent(idiom: UIUserInterfaceIdiom, version: OperatingSystemVersion = ProcessInfo.processInfo.operatingSystemVersion) -> String {
        let safari = "\(version.majorVersion).\(version.minorVersion)"
        let engine = "AppleWebKit/605.1.15 (KHTML, like Gecko)"
        if idiom == .phone {
            return "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) \(engine) Version/\(safari) Mobile/15E148 Safari/604.1"
        }
        return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) \(engine) Version/\(safari) Safari/605.1.15"
    }
    static func allowsNavigation(_ url: URL, mainFrame: Bool) -> Bool {
        if address(url.absoluteString) != nil { return true }
        if url.absoluteString == "about:blank" { return true }
        return !mainFrame && ["about", "blob", "data"].contains(url.scheme?.lowercased() ?? "")
    }
    var domain: String {
        let host = url?.host?.lowercased() ?? ""
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }
    func load(_ url: URL, offset: CGFloat? = nil, animateSearch: Bool = false) {
        error = nil
        let navigation = web.load(URLRequest(url: url))
        if let navigation, let offset { pendingScroll = (navigation, offset) }
        else { pendingScroll = nil }
        searchNavigation = animateSearch ? navigation : nil
    }
    var scrollPosition: CGFloat { pendingScroll?.offset ?? web.scrollView.contentOffset.y }
    func go(to item: WKBackForwardListItem, offset: CGFloat) -> WKNavigation? {
        let navigation = web.go(to: item)
        pendingScroll = navigation.map { ($0, offset) }
        return navigation
    }
    func restoreScrollPosition(_ offset: CGFloat) {
        if web.isLoading, let currentNavigation { pendingScroll = (currentNavigation, offset) }
        else {
            pendingScroll = nil
            web.scrollView.setContentOffset(CGPoint(x: 0, y: offset), animated: false)
        }
    }
    static func clearBrowsingData(in store: WKWebsiteDataStore = .default(), preferences: UserDefaults = .standard) async {
        if preferences === UserDefaults.standard { BrowserAdBlocker.shared.clearExceptions() }
        else { BrowserAdBlocker.clearExceptions(in: preferences) }
        // Drop every browser's page and back/forward list before clearing shared website storage.
        NotificationCenter.default.post(name: browsingDataWillClear, object: nil)
        for key in preferences.dictionaryRepresentation().keys where key.hasPrefix("browser.last-page.") {
            preferences.removeObject(forKey: key)
        }
        await store.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast)
    }
    private func update() {
        url = web.url; title = web.title ?? ""; loading = web.isLoading
        canGoBack = web.canGoBack; canGoForward = web.canGoForward
        pageColor = web.themeColor ?? web.underPageBackgroundColor
        web.backgroundColor = pageColor
        web.scrollView.backgroundColor = pageColor
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        currentNavigation = navigation
        if pendingScroll?.navigation !== navigation { pendingScroll = nil }
        pdfDownload?.cancel()
        isPDF = false
        web.invalidateSelection()
        webView.findInteraction?.dismissFindNavigator()
        navigationBegan?()
        navigationID = UUID(); error = nil; update()
    }
    func webView(_ webView: WKWebView, didReceiveServerRedirectForProvisionalNavigation navigation: WKNavigation!) {
        update()
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        update()
        if let item = webView.backForwardList.currentItem { committed?(item) }
        if let pendingScroll, pendingScroll.navigation === navigation {
            Task { @MainActor [weak self] in
                guard let self, self.pendingScroll?.navigation === navigation else { return }
                let top = (pendingScroll.offset + webView.scrollView.adjustedContentInset.top) / webView.scrollView.zoomScale
                _ = try? await webView.callAsyncJavaScript("""
                    await new Promise(requestAnimationFrame);
                    window.scrollTo({left: 0, top, behavior: 'instant'});
                    """, arguments: ["top": top], in: nil, contentWorld: .world(name: "LeximoryBrowserPosition"))
                guard self.pendingScroll?.navigation === navigation else { return }
                webView.scrollView.setContentOffset(CGPoint(x: 0, y: pendingScroll.offset), animated: false)
                self.pendingScroll = nil
            }
        }
    }
    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        canReloadForBlocking = pendingReloadSafety
        update()
        if let item = webView.backForwardList.currentItem { committed?(item) }
        if let searchNavigation, navigation === searchNavigation {
            self.searchNavigation = nil
            guard webView.window != nil, !UIAccessibility.isReduceMotionEnabled else { return }
            let transition = CATransition()
            transition.type = .push
            transition.subtype = webView.effectiveUserInterfaceLayoutDirection == .rightToLeft ? .fromLeft : .fromRight
            transition.duration = 0.3
            transition.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            webView.layer.add(transition, forKey: "searchNavigation")
        }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) { failed(error, navigation: navigation) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) { failed(error, navigation: navigation) }
    private func failed(_ error: any Error, navigation: WKNavigation?) {
        if pendingScroll?.navigation === navigation { pendingScroll = nil }
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        let failure = error as NSError
        Logger(subsystem: "com.leximory.reader", category: "browser").error("Navigation failed: host=\(self.web.url?.host ?? "unknown", privacy: .private) domain=\(failure.domain, privacy: .public) code=\(failure.code)")
        self.error = "网页未能打开，请重试或在 Safari 中打开。"; update()
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let destination = navigationAction.request.url,
              Self.allowsNavigation(destination, mainFrame: navigationAction.targetFrame?.isMainFrame != false) else { return .cancel }
        if navigationAction.navigationType == .backForward, navigationAction.targetFrame?.isMainFrame != false,
           historyGesture?(destination) == true { return .cancel }
        if navigationAction.targetFrame?.isMainFrame == true {
            let request = UUID()
            policyRequest = request
            for attempt in 0..<2 {
                do {
                    let policy = try await adBlocker.currentPolicy()
                    guard policyRequest == request else { return .cancel }
                    installBlocking(policy)
                    break
                } catch {
                    guard policyRequest == request else { return .cancel }
                    if attempt == 1 {
                        Logger(subsystem: "com.leximory.reader", category: "browser").error("Ad rules could not be prepared; preserving available browser rules")
                    }
                }
            }
            pendingReloadSafety = navigationAction.request.httpMethod == "GET"
                && navigationAction.navigationType != .formSubmitted && navigationAction.navigationType != .formResubmitted
        }
        return .allow
    }
    func installBlocking(_ policy: BrowserBlockingPolicy) {
        let controller = web.configuration.userContentController
        for list in blockingLists { controller.remove(list) }
        for list in policy.lists { controller.add(list) }
        blockingLists = policy.lists
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse) async -> WKNavigationResponsePolicy {
        if navigationResponse.isForMainFrame {
            isPDF = navigationResponse.response.mimeType?.lowercased() == "application/pdf"
        }
        if navigationResponse.isForMainFrame, let response = navigationResponse.response as? HTTPURLResponse {
            Logger(subsystem: "com.leximory.reader", category: "browser").info("Page response: host=\(response.url?.host ?? "unknown", privacy: .private) status=\(response.statusCode)")
        }
        return .allow
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, Self.address(url.absoluteString) != nil {
            pendingScroll = nil; error = nil
            web.load(navigationAction.request)
        }
        return nil
    }
}

struct BrowserArticleDraft: Identifiable {
    let id = UUID()
    let url: URL
    let title: String
    let content: String
    var sourceFolderID: String? = nil
}

extension TextBrowserModel {
    func pdfFile() async throws -> BrowserEbookFile {
        guard isPDF, let url else { throw URLError(.cancelled) }
        let navigation = navigationID
        return try await MutationRetry.run { @MainActor in
            guard navigation == self.navigationID else { throw URLError(.cancelled) }
            let download = BrowserPDFDownload()
            self.pdfDownload?.cancel()
            self.pdfDownload = download
            defer { if self.pdfDownload === download { self.pdfDownload = nil } }
            let file = try await download.file(from: self.web, url: url)
            guard navigation == self.navigationID else { throw URLError(.cancelled) }
            return file
        }
    }

    func extractArticle() async throws -> BrowserArticleDraft {
        guard let url, let resource = Bundle.main.url(forResource: "defuddle", withExtension: "js") else { throw URLError(.cannotParseResponse) }
        let source = try String(contentsOf: resource, encoding: .utf8)
        let navigation = navigationID
        let script = source + """
        \nconst result = new globalThis.Defuddle(document.cloneNode(true), {url: location.href, markdown: true}).parse();
        return {title: result.title || document.title, content: result.contentMarkdown || result.content || ''};
        """
        let value = try await web.callAsyncJavaScript(script, arguments: [:], in: nil, contentWorld: .world(name: "LeximoryArticleExtraction"))
        guard navigation == navigationID, let payload = value as? [String: String], let content = payload["content"] else { throw URLError(.cancelled) }
        return BrowserArticleDraft(url: url, title: payload["title"] ?? title, content: ArticleMarkdownDocument.strippingLinks(content))
    }
}

struct BrowserWebContent: UIViewRepresentable {
    let model: TextBrowserModel
    var reservesBottomControls = true
    func makeUIView(context: Context) -> BrowserWebView { model.web }
    func updateUIView(_ uiView: BrowserWebView, context: Context) {
        let bottomInset: CGFloat = reservesBottomControls ? 80 : 0
        if uiView.scrollView.contentInset.bottom != bottomInset {
            uiView.scrollView.contentInset.bottom = bottomInset
        }
    }
    static func dismantleUIView(_ uiView: BrowserWebView, coordinator: ()) {
        uiView.stopLoading(); uiView.lookup = nil
    }
}
