import Foundation
import Testing
import UIKit
import WebKit
@testable import Leximory

@MainActor struct JapaneseEbookTests {
    @Test(arguments: [CGSize(width: 390, height: 844), CGSize(width: 820, height: 1180), CGSize(width: 1024, height: 768)])
    func japanesePaginationRubySelectionAndCancelledTurn(size: CGSize) async throws {
        let page = try #require(Bundle.main.url(forResource: "ebook-reader", withExtension: "html"))
        let book = try #require(Bundle.main.url(forResource: "japanese-fixture", withExtension: "epub"))
        let font = try #require(Bundle.main.url(forResource: "ChillDuanHeiSongProJP_Regular", withExtension: "otf"))
        let config = WKWebViewConfiguration(); config.websiteDataStore = .nonPersistent()
        let probe = EbookBridgeProbe(); config.userContentController.add(probe, name: "reader")
        let web = WKWebView(frame: CGRect(origin: .zero, size: size), configuration: config)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene); window.frame = web.frame
        window.rootViewController = UIViewController(); window.rootViewController?.view.addSubview(web); window.isHidden = false
        defer { window.isHidden = true; config.userContentController.removeScriptMessageHandler(forName: "reader") }
        web.navigationDelegate = probe
        try await probe.load(web, url: page)
        let theme = ["paper": "#ffffff", "ink": "#192024", "size": "20", "leading": "1.6", "weight": "400", "writing": "vertical-rl"]
        let fontURL = "data:font/otf;base64," + (try Data(contentsOf: font)).base64EncodedString()
        _ = try await web.callAsyncJavaScript("await window.openBook(bytes, '', fonts, theme, [])", arguments: [
            "bytes": try Data(contentsOf: book).base64EncodedString(),
            "fonts": ["regular": fontURL, "italic": fontURL, "display": fontURL], "theme": theme
        ], in: nil, contentWorld: .page)
        #expect(probe.failure == nil)
        #expect(probe.ready)
        let layout = try #require(try await web.callAsyncJavaScript("""
            const c = rendition.getContents()[0], root = c.document.documentElement;
            const ruby = c.document.querySelector('ruby'), rt = ruby.querySelector('rt');
            const rubyBounds = ruby.getBoundingClientRect(), rtBounds = rt.getBoundingClientRect();
            return {mode:c.window.getComputedStyle(root).writingMode, direction:c.window.getComputedStyle(root).direction,
              pages:rendition.currentLocation().start.displayed.total, ruby:rt.textContent,
              rubyBeside:rtBounds.x >= rubyBounds.x, height:root.scrollHeight, width:root.scrollWidth};
            """, arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
        #expect(layout["mode"] as? String == "vertical-rl")
        #expect(layout["direction"] as? String == "ltr")
        #expect((layout["pages"] as? Int ?? 0) > 1)
        #expect(layout["ruby"] as? String == "とうきょう")
        #expect(layout["rubyBeside"] as? Bool == true)
        let initial = try #require(probe.location)
        _ = try await web.callAsyncJavaScript("return await window.readerTurn('next')", arguments: [:], in: nil, contentWorld: .page)
        #expect(probe.location == initial) // A preview must not publish a position write.
        _ = try await web.callAsyncJavaScript("return await window.readerTurn('cancel')", arguments: [:], in: nil, contentWorld: .page)
        #expect(probe.location == initial)
        _ = try await web.callAsyncJavaScript("await window.readerTurn('next'); await window.readerTurn('commit')", arguments: [:], in: nil, contentWorld: .page)
        #expect(probe.location != initial)
        let beforeKeyboard = probe.location
        _ = try await web.callAsyncJavaScript("""
            const c = rendition.getContents()[0];
            c.document.body.dispatchEvent(new c.window.KeyboardEvent('keydown', {key:'ArrowLeft', bubbles:true, cancelable:true}));
            for (let i=0; i<100 && rendition.currentLocation().start.cfi === origin; i++) await new Promise(resolve => setTimeout(resolve,20));
            await painted();
            """, arguments: ["origin": try #require(beforeKeyboard)], in: nil, contentWorld: .page)
        #expect(probe.location != beforeKeyboard)
        _ = try await web.callAsyncJavaScript("await rendition.display(location); await painted()", arguments: ["location": initial], in: nil, contentWorld: .page)
        _ = try await web.callAsyncJavaScript("""
            const c = rendition.getContents()[0], node = c.document.querySelector('ruby').firstChild;
            const range = c.document.createRange(); range.setStart(node, 0); range.setEnd(node, 2);
            const selection = c.window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
            await painted();
            """, arguments: [:], in: nil, contentWorld: .page)
        let selected = try #require(probe.selection)
        let quote = try #require(selected["quote"] as? String)
        let context = try #require(selected["context"] as? String)
        let offset = try #require(selected["offset"] as? Int)
        #expect(quote == "東京")
        #expect((context as NSString).substring(with: NSRange(location: offset, length: quote.utf16.count)) == quote)
        _ = try await web.callAsyncJavaScript("""
            rendition.getContents()[0].window.getSelection().removeAllRanges();
            await window.readerTheme({...theme, size:'24', paper:'#100f0f', ink:'#cecdc3'});
            await painted();
            """, arguments: ["theme": theme], in: nil, contentWorld: .page)
        let mode = try await web.callAsyncJavaScript("return rendition.getContents()[0].window.getComputedStyle(rendition.getContents()[0].document.documentElement).writingMode", arguments: [:], in: nil, contentWorld: .page) as? String
        #expect(mode == "vertical-rl")
        #expect(probe.failure == nil)
    }
}

@MainActor private final class EbookBridgeProbe: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    var ready = false
    var failure: String?
    var location: String?
    var selection: [String: Any]?
    private var loaded: CheckedContinuation<Void, any Error>?
    func load(_ web: WKWebView, url: URL) async throws {
        try await withCheckedThrowingContinuation { continuation in
            loaded = continuation
            web.loadFileURL(url, allowingReadAccessTo: Bundle.main.bundleURL)
        }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loaded?.resume(); loaded = nil }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) { loaded?.resume(throwing: error); loaded = nil }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) { loaded?.resume(throwing: error); loaded = nil }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        switch body["kind"] as? String {
        case "ready": ready = true
        case "failed": failure = body["message"] as? String
        case "location": location = body["location"] as? String
        case "selected": selection = body
        default: break
        }
    }
}
