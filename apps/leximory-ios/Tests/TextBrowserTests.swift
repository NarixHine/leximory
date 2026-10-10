import Foundation
import Testing
import WebKit
@testable import Leximory

@MainActor struct TextBrowserTests {
    @Test func addressesOnlyAllowWebPages() {
        #expect(TextBrowserModel.address("example.com/article")?.absoluteString == "https://example.com/article")
        #expect(TextBrowserModel.address("javascript:alert(1)") == nil)
        #expect(TextBrowserModel.address("file:///private/article") == nil)
        #expect(TextBrowserModel.address("https://name:password@example.com") == nil)
        #expect(TextBrowserModel.address("a search query") == nil)
    }

    @Test func selectionPreservesRubyAndUTF16OffsetsWithoutReadingEditableFields() async throws {
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let web = BrowserWebView(frame: .zero, configuration: config)
        let navigation = BrowserTestNavigation(); web.navigationDelegate = navigation
        try await navigation.load(web, html: """
            <html><body><p>🌍 Before <ruby id="word">日本語<rt>にほんご</rt></ruby> after.</p>
            <p contenteditable="true" id="private">private note</p></body></html>
            """)
        _ = try await web.callAsyncJavaScript("""
            const range = document.createRange(); range.selectNode(document.getElementById('word'));
            const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
            """, arguments: [:], in: nil, contentWorld: .page)
        let value = try await web.callAsyncJavaScript(BrowserWebView.selectionScript, arguments: [:], in: nil,
            contentWorld: .world(name: "LeximoryBrowserSelection"))
        let data = try JSONSerialization.data(withJSONObject: #require(value))
        let selection = try JSONDecoder().decode(BrowserSelection.self, from: data)
        #expect(selection.quote == "日本語")
        #expect(selection.context == "🌍 Before 日本語 after.")
        #expect(selection.offset == "🌍 Before ".utf16.count)
        _ = try await web.callAsyncJavaScript("""
            const range = document.createRange(); range.selectNodeContents(document.getElementById('private'));
            const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
            """, arguments: [:], in: nil, contentWorld: .page)
        let privateSelection = try await web.callAsyncJavaScript(BrowserWebView.selectionScript, arguments: [:], in: nil,
            contentWorld: .world(name: "LeximoryBrowserSelection"))
        #expect(privateSelection == nil || privateSelection is NSNull)
        #expect(config.userContentController.userScripts.isEmpty)
    }
}

@MainActor private final class BrowserTestNavigation: NSObject, WKNavigationDelegate {
    private var continuation: CheckedContinuation<Void, any Error>?
    func load(_ web: WKWebView, html: String) async throws {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            web.loadHTMLString(html, baseURL: URL(string: "https://example.com"))
        }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { continuation?.resume(); continuation = nil }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) { continuation?.resume(throwing: error); continuation = nil }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) { continuation?.resume(throwing: error); continuation = nil }
}
