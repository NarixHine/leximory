import SwiftUI
import WebKit
import LeximoryCore
import os

struct BrowserSelection: Decodable {
    let quote: String
    let context: String
    let offset: Int
    let url: String
}

final class BrowserWebView: WKWebView {
    var lookup: ((BrowserSelection) -> Void)?
    private var capturedSelection: BrowserSelection?
    private static let world = WKContentWorld.world(name: "LeximoryBrowserSelection")
    static let selectionScript = """
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
        const range = selection.getRangeAt(0);
        const element = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
        if (!element || element.closest('input,textarea,[contenteditable]:not([contenteditable="false"]),script,style')) return null;
        const clean = (fragment) => {
          fragment.querySelectorAll('rt,rp,script,style').forEach(node => node.remove());
          return fragment.textContent || '';
        };
        const quote = clean(range.cloneContents());
        if (!quote.trim() || quote.length > 1024) return null;
        const block = element.closest('p,li,blockquote,h1,h2,h3,h4,h5,h6,td,pre') || element;
        if (!block.contains(range.endContainer)) return null;
        const before = document.createRange();
        before.selectNodeContents(block);
        before.setEnd(range.startContainer, range.startOffset);
        const prefix = clean(before.cloneContents());
        const after = document.createRange();
        after.selectNodeContents(block);
        after.setStart(range.endContainer, range.endOffset);
        const suffix = clean(after.cloneContents());
        const leading = prefix.slice(-1200);
        return {quote, context: leading + quote + suffix.slice(0,1200), offset: leading.length, url: location.href};
        """

    override func buildMenu(with builder: UIMenuBuilder) {
        super.buildMenu(with: builder)
        guard builder.system == .context else { return }
        guard !super.canPerformAction(#selector(UIResponderStandardEditActions.cut(_:)), withSender: nil) else { return }
        ReadingSelectionMenu.removeUnrelatedActions(from: builder)
        builder.replaceChildren(ofMenu: .root) { ReadingSelectionMenu.copyActions($0) }
        capturedSelection = nil
        capture { [weak self] selection in self?.capturedSelection = selection }
        let action = UIAction(title: ReadingSelectionMenu.lookupTitle, image: ReadingSelectionMenu.lookupImage) { [weak self] _ in
            guard let self else { return }
            if let capturedSelection { lookup?(capturedSelection) }
            else { capture { [weak self] in if let selection = $0 { self?.lookup?(selection) } } }
        }
        builder.insertSibling(UIMenu(title: "", options: .displayInline, children: [action]), beforeMenu: .standardEdit)
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
    @ObservationIgnored let web: BrowserWebView
    private(set) var url: URL?
    private(set) var title = ""
    private(set) var loading = false
    private(set) var canGoBack = false
    private(set) var canGoForward = false
    private(set) var navigationID = UUID()
    var error: String?
    @ObservationIgnored private var resumeOffset: CGFloat?
    @ObservationIgnored private var observations: [NSKeyValueObservation] = []

    override init() {
        let configuration = WKWebViewConfiguration()
        // No app credentials or native message handlers are exposed to websites.
        web = BrowserWebView(frame: .zero, configuration: configuration)
        super.init()
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.scrollView.contentInset.bottom = 80
        observations = [
            web.observe(\.url, options: [.new]) { [weak self] _, _ in Task { @MainActor in self?.update() } },
            web.observe(\.isLoading, options: [.new]) { [weak self] _, _ in Task { @MainActor in self?.update() } },
            web.observe(\.canGoBack, options: [.new]) { [weak self] _, _ in Task { @MainActor in self?.update() } },
            web.observe(\.canGoForward, options: [.new]) { [weak self] _, _ in Task { @MainActor in self?.update() } },
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
    var domain: String {
        let host = url?.host?.lowercased() ?? ""
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }
    func load(_ url: URL, offset: CGFloat? = nil) {
        resumeOffset = offset
        error = nil
        web.load(URLRequest(url: url))
    }
    private func update() {
        url = web.url; title = web.title ?? ""; loading = web.isLoading
        canGoBack = web.canGoBack; canGoForward = web.canGoForward
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        navigationID = UUID(); error = nil; update()
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        update()
        if let resumeOffset {
            webView.scrollView.setContentOffset(CGPoint(x: 0, y: resumeOffset), animated: false)
            self.resumeOffset = nil
        }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) { failed(error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) { failed(error) }
    private func failed(_ error: any Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        self.error = "网页未能打开，请重试或在 Safari 中打开。"; update()
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let destination = navigationAction.request.url,
              destination.absoluteString == "about:blank" || Self.address(destination.absoluteString) != nil else { return .cancel }
        return .allow
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, Self.address(url.absoluteString) != nil { load(url) }
        return nil
    }
}

struct BrowserWebContent: UIViewRepresentable {
    let model: TextBrowserModel
    func makeUIView(context: Context) -> BrowserWebView { model.web }
    func updateUIView(_ uiView: BrowserWebView, context: Context) {}
    static func dismantleUIView(_ uiView: BrowserWebView, coordinator: ()) {
        uiView.stopLoading(); uiView.lookup = nil
    }
}
