import Foundation
import Testing
import WebKit
import SwiftUI
@testable import Leximory

@MainActor @Suite(.serialized) struct TextBrowserTests {
    @Test func extractedArticleCountsReadableLinkTextRatherThanHiddenAddresses() async throws {
        let model = TextBrowserModel(websiteDataStore: .nonPersistent())
        defer { model.web.stopLoading() }
        let address = "https://example.com/read?tracking=" + String(repeating: "x", count: 2000)
        let paragraph = "A quiet river runs through the garden. Take time to notice the words in their context."
        let html = "<html><head><title>A river journey</title></head><body><article><h1>A river journey</h1>" +
            (0..<10).map { _ in "<p>\(paragraph) <a href='\(address)'>Read more</a>.</p>" }.joined() + "</article></body></html>"
        model.web.loadHTMLString(html, baseURL: URL(string: "https://example.com/article"))
        for _ in 0..<200 {
            if model.url != nil, !model.web.isLoading { break }
            try await Task.sleep(for: .milliseconds(50))
        }
        let draft = try await model.extractArticle()
        #expect(draft.content.contains(paragraph))
        #expect(draft.content.contains("Read more"))
        #expect(!draft.content.contains("tracking="))
        #expect(draft.content.utf16.count < 10000)
    }
    @Test func addressEditingKeepsTheDraftAndCompositionAcrossViewUpdates() async throws {
        let editor = BrowserAddressEditor()
        var submitted: String?
        var drafts: [String] = []
        let fieldView = BrowserAddressField(address: "https://example.com", editor: editor) {
            submitted = editor.field?.text
        } draftChanged: { drafts.append($0) }
        let controller = UIHostingController(rootView: fieldView)
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = controller
        window.makeKeyAndVisible()
        defer { editor.field?.wantsFocus = false; editor.field?.resignFirstResponder(); window.isHidden = true }
        controller.view.layoutIfNeeded()
        for _ in 0..<100 {
            if editor.field?.isFirstResponder == true { break }
            try await Task.sleep(for: .milliseconds(20))
        }
        let field = try #require(editor.field)
        #expect(field.isFirstResponder)
        field.text = ""
        field.insertText("r")
        let keyboardDelegate = field.inputDelegate
        let inputChanges = BrowserInputChanges()
        field.inputDelegate = inputChanges
        field.sendActions(for: .editingChanged)
        controller.rootView = fieldView
        controller.view.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(30))
        #expect(inputChanges.textChanges == 0)
        #expect(inputChanges.selectionChanges == 0)
        field.inputDelegate = keyboardDelegate
        #expect(field.text == "r")
        #expect(drafts.last == "r")
        let caret = try #require(field.selectedTextRange)
        #expect(caret.isEmpty)
        #expect(field.offset(from: field.beginningOfDocument, to: caret.start) == 1)
        field.insertText("iver")
        field.selectedTextRange = field.textRange(from: field.endOfDocument, to: field.endOfDocument)
        field.setMarkedText("猫忆", selectedRange: NSRange(location: 2, length: 0))
        let composing = field.text
        controller.rootView = fieldView
        controller.view.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(30))
        #expect(field.markedTextRange != nil)
        #expect(field.text == composing)
        field.unmarkText()
        field.sendActions(for: .editingChanged)
        try await Task.sleep(for: .milliseconds(30))
        #expect(field.font?.pointSize == LeximoryTypography.addressUI.pointSize)
        #expect(field.font?.fontName == "EBGaramond-Regular")
        #expect(drafts.last == "river猫忆")
        let committed = try #require(field.attributedText)
        let chineseFont = try #require(committed.attribute(.font, at: 5, effectiveRange: nil) as? UIFont)
        #expect(abs(chineseFont.pointSize - LeximoryTypography.addressUI.pointSize * 0.85) < 0.001)
        let committedCaret = try #require(field.selectedTextRange)
        #expect(committedCaret.isEmpty)
        #expect(field.offset(from: field.beginningOfDocument, to: committedCaret.start) == 7)
        _ = field.delegate?.textFieldShouldReturn?(field)
        #expect(submitted == "river猫忆")
    }

    @Test func addressInputSizesChineseDuringInitialDisplayEditingAndDynamicTypeChanges() throws {
        let field = BrowserURLTextField(frame: CGRect(x: 0, y: 0, width: 360, height: 48))
        field.wantsFocus = false
        field.placeholder = "输入网址或搜索"
        field.text = "A猫，。𠀀かな🙂"

        func checkSizes() throws {
            let text = try #require(field.attributedText)
            let base = try #require(text.attribute(.font, at: 0, effectiveRange: nil) as? UIFont).pointSize
            if field.traitCollection.preferredContentSizeCategory.isAccessibilityCategory {
                #expect(base > 18)
            } else {
                #expect(base == 18)
            }
            var offset = 0
            for (glyph, scale): (String, CGFloat) in [
                ("A", 1), ("猫", 0.85), ("，", 0.85), ("。", 0.85), ("𠀀", 0.85),
                ("か", 1), ("な", 1), ("🙂", 1)
            ] {
                let font = try #require(text.attribute(.font, at: offset, effectiveRange: nil) as? UIFont)
                #expect(abs(font.pointSize - base * scale) < 0.001, "Incorrect input size for \(glyph)")
                offset += glyph.utf16.count
            }
            let placeholder = try #require(field.attributedPlaceholder)
            let font = try #require(placeholder.attribute(.font, at: 0, effectiveRange: nil) as? UIFont)
            #expect(abs(font.pointSize - base * 0.85) < 0.001)
        }

        try checkSizes()
        field.selectedTextRange = field.textRange(from: field.endOfDocument, to: field.endOfDocument)
        field.insertText("猫")
        field.sendActions(for: .editingChanged)
        let edited = try #require(field.attributedText)
        let lastFont = try #require(edited.attribute(.font, at: edited.length - 1, effectiveRange: nil) as? UIFont)
        #expect(abs(lastFont.pointSize - 18 * 0.85) < 0.001)
        let caret = try #require(field.selectedTextRange)
        #expect(field.offset(from: field.beginningOfDocument, to: caret.start) == edited.length)
        field.deleteBackward()
        field.sendActions(for: .editingChanged)
        try checkSizes()

        field.traitOverrides.preferredContentSizeCategory = .accessibilityExtraExtraExtraLarge
        field.updateTraitsIfNeeded()
        try checkSizes()
    }

    @Test func selectionReadsOnlyBoundedContextWithoutCloningLargeParagraphs() async throws {
        let web = BrowserWebView(frame: .zero, configuration: WKWebViewConfiguration())
        let navigation = BrowserTestNavigation(); web.navigationDelegate = navigation
        try await navigation.load(web, html: "<html><body><p id='block'></p></body></html>")
        _ = try await web.callAsyncJavaScript("""
            const block = document.getElementById('block');
            block.append('x'.repeat(1000000));
            const word = document.createElement('ruby'); word.id = 'word';
            word.innerHTML = '日本語<rt>にほんご</rt>'; block.append(word);
            block.append('y'.repeat(1000000));
            const range = document.createRange(); range.selectNode(word);
            const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
            """, arguments: [:], in: nil, contentWorld: .page)
        let value = try await web.callAsyncJavaScript("""
            Range.prototype.cloneContents = () => { throw new Error('Selection must not clone DOM'); };
            """ + BrowserWebView.selectionScript, arguments: [:], in: nil,
            contentWorld: .world(name: "LeximoryBrowserSelection"))
        let data = try JSONSerialization.data(withJSONObject: #require(value))
        let selection = try JSONDecoder().decode(BrowserSelection.self, from: data)
        #expect(selection.quote == "日本語")
        #expect(selection.context == String(repeating: "x", count: 1200) + "日本語" + String(repeating: "y", count: 1200))
        #expect(selection.offset == 1200)
    }

    @Test(arguments: ["text", "element", "nested", "oversized", "crossBlock"])
    func selectionHandlesDOMBoundariesAndRejectsInvalidRanges(kind: String) async throws {
        let web = BrowserWebView(frame: .zero, configuration: WKWebViewConfiguration())
        let navigation = BrowserTestNavigation(); web.navigationDelegate = navigation
        try await navigation.load(web, html: """
            <html><body><p id="block">🌍 Before <b id="word">quiet <i>forest</i></b><script>private script</script> after.</p><p id="other">another paragraph</p></body></html>
            """)
        _ = try await web.callAsyncJavaScript("""
            const word = document.getElementById('word');
            const range = document.createRange();
            if (kind === 'text') { range.setStart(word.firstChild, 0); range.setEnd(word.lastChild.firstChild, 6); }
            else if (kind === 'nested') { range.selectNodeContents(word); }
            else if (kind === 'oversized') { word.textContent = 'a'.repeat(1025); range.selectNodeContents(word); }
            else if (kind === 'crossBlock') { range.setStart(word.firstChild, 0); range.setEnd(document.getElementById('other').firstChild, 7); }
            else { range.selectNode(word); }
            const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
            """, arguments: ["kind": kind], in: nil, contentWorld: .page)
        let value = try await web.callAsyncJavaScript(BrowserWebView.selectionScript, arguments: [:], in: nil,
            contentWorld: .world(name: "LeximoryBrowserSelection"))
        if kind == "oversized" || kind == "crossBlock" {
            #expect(value == nil || value is NSNull)
        } else {
            let data = try JSONSerialization.data(withJSONObject: #require(value))
            let selection = try JSONDecoder().decode(BrowserSelection.self, from: data)
            #expect(selection.quote == "quiet forest")
            #expect(selection.context == "🌍 Before quiet forest after.")
            #expect(selection.offset == "🌍 Before ".utf16.count)
        }
    }

    @Test func clearingBrowsingDataRemovesCookiesAndAllRememberedPagesOnly() async throws {
        let suite = "browser-purge-test." + UUID().uuidString
        let preferences = try #require(UserDefaults(suiteName: suite))
        defer { preferences.removePersistentDomain(forName: suite) }
        preferences.set("old page", forKey: "browser.last-page.account-a")
        preferences.set("another page", forKey: "browser.last-page.account-b")
        preferences.set("keep", forKey: "browser.domain-rules")
        preferences.set("keep", forKey: "account.session")
        let store = WKWebsiteDataStore.nonPersistent()
        let cookie = try #require(HTTPCookie(properties: [
            .domain: "example.com", .path: "/", .name: "session", .value: "test",
            .expires: Date().addingTimeInterval(3600)
        ]))
        await store.httpCookieStore.setCookie(cookie)
        #expect(await store.httpCookieStore.allCookies().count == 1)

        await TextBrowserModel.clearBrowsingData(in: store, preferences: preferences)

        #expect(await store.httpCookieStore.allCookies().isEmpty)
        #expect(preferences.object(forKey: "browser.last-page.account-a") == nil)
        #expect(preferences.object(forKey: "browser.last-page.account-b") == nil)
        #expect(preferences.string(forKey: "browser.domain-rules") == "keep")
        #expect(preferences.string(forKey: "account.session") == "keep")
    }
    @Test func embeddedVerificationFramesCanRunTheirOwnScripts() async throws {
        let model = TextBrowserModel(websiteDataStore: .nonPersistent())
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = UIViewController()
        window.rootViewController?.view.addSubview(model.web)
        model.web.frame = window.bounds
        window.makeKeyAndVisible()
        defer { model.web.stopLoading(); window.isHidden = true }
        model.web.loadHTMLString("""
            <html><body><script>window.frameReady=false;addEventListener('message',e=>{if(e.data==='frame-ready')window.frameReady=true})</script>
            <iframe srcdoc="<script>parent.postMessage('frame-ready','*')</script>"></iframe></body></html>
            """, baseURL: URL(string: "https://example.com"))
        for _ in 0..<100 {
            try await Task.sleep(for: .milliseconds(20))
            if (try? await model.web.evaluateJavaScript("window.frameReady") as? Bool) == true { return }
        }
        Issue.record("Embedded verification content was prevented from loading")
    }

    @Test func safariIdentityMatchesTheActualBrowserAndDeviceMode() async throws {
        let version = OperatingSystemVersion(majorVersion: 27, minorVersion: 1, patchVersion: 0)
        let phone = TextBrowserModel.safariUserAgent(idiom: .phone, version: version)
        let tablet = TextBrowserModel.safariUserAgent(idiom: .pad, version: version)
        #expect(phone.contains("Version/27.1 Mobile/15E148 Safari/604.1"))
        #expect(phone.contains("iPhone OS 18_6"))
        #expect(tablet.contains("Macintosh; Intel Mac OS X 10_15_7"))
        #expect(tablet.hasSuffix("Version/27.1 Safari/605.1.15"))
        let model = TextBrowserModel()
        let navigation = BrowserTestNavigation(); model.web.navigationDelegate = navigation
        try await navigation.load(model.web, html: "<html><body>Browser identity</body></html>")
        let agent = try #require(try await model.web.evaluateJavaScript("navigator.userAgent") as? String)
        #expect(agent == model.web.customUserAgent)
        #expect(agent.contains("Version/") && agent.contains("Safari/"))
        #expect(try await model.web.evaluateJavaScript("navigator.cookieEnabled") as? Bool == true)
        #expect(model.web.configuration.defaultWebpagePreferences.preferredContentMode == (UIDevice.current.userInterfaceIdiom == .phone ? .mobile : .desktop))
    }
    @Test func keywordsSearchBingWithoutChangingURLNavigation() throws {
        for query in ["occidental", "occidental countries", "文言文词汇 & phrases", "site:nytimes.com books"] {
            let url = try #require(TextBrowserModel.destination(query))
            let components = try #require(URLComponents(url: url, resolvingAgainstBaseURL: false))
            #expect(components.host == "www.bing.com")
            #expect(components.path == "/search")
            #expect(components.queryItems == [URLQueryItem(name: "q", value: query)])
        }
        #expect(TextBrowserModel.destination("example.com/article")?.absoluteString == "https://example.com/article")
        #expect(TextBrowserModel.destination("https://www.nytimes.com/")?.host == "www.nytimes.com")
        #expect(TextBrowserModel.destination(" ") == nil)
        #expect(TextBrowserModel.destination("javascript:alert(1)") == nil)
        #expect(TextBrowserModel.destination("file:///private/article") == nil)
    }
    @Test func embeddedWebContentCanNavigateWithoutOpeningNativeSchemes() {
        for raw in ["about:srcdoc", "blob:https://example.com/id", "data:text/html,frame"] {
            let url = URL(string: raw)!
            #expect(TextBrowserModel.allowsNavigation(url, mainFrame: false))
            #expect(!TextBrowserModel.allowsNavigation(url, mainFrame: true))
        }
        #expect(!TextBrowserModel.allowsNavigation(URL(string: "file:///private/article")!, mainFrame: false))
        #expect(TextBrowserModel.allowsNavigation(URL(string: "https://example.com/challenge")!, mainFrame: false))
    }

    @Test func browserChromeTracksPageThemeAndBackground() async throws {
        let model = TextBrowserModel(websiteDataStore: .nonPersistent())
        let navigation = BrowserTestNavigation()
        model.web.navigationDelegate = navigation
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        window.rootViewController = UIViewController()
        window.rootViewController?.view.addSubview(model.web)
        model.web.frame = window.bounds
        window.makeKeyAndVisible()
        defer { window.isHidden = true }
        try await navigation.load(model.web, html: """
            <html><head><meta name="theme-color" content="#d4ddc9"></head>
            <body style="background:#fffdf7">A quiet forest</body></html>
            """)
        try await expectPageColor(model, red: 212, green: 221, blue: 201)
        _ = try await model.web.evaluateJavaScript("document.querySelector('meta[name=theme-color]').content = '#c8d6bd'")
        try await expectPageColor(model, red: 200, green: 214, blue: 189)
        _ = try await model.web.evaluateJavaScript("document.querySelector('meta[name=theme-color]').remove()")
        try await expectPageColor(model, red: 255, green: 253, blue: 247)
        try await navigation.load(model.web, html: """
            <html><head><meta name="viewport" content="width=device-width,initial-scale=1">
            <meta name="theme-color" content="#18202a"></head>
            <body style="background:#101820;min-height:1600px">A dark forest</body></html>
            """)
        try await expectPageColor(model, red: 24, green: 32, blue: 42)
        let scrollView = model.web.scrollView
        #expect(scrollView.contentSize.height > scrollView.bounds.height)
        scrollView.setContentOffset(CGPoint(x: 0, y: scrollView.contentSize.height - scrollView.bounds.height + scrollView.adjustedContentInset.bottom), animated: false)
        try await expectPageColor(model, red: 24, green: 32, blue: 42)
        #expect(scrollView.contentInset.bottom == 80)
        _ = try await model.web.evaluateJavaScript("document.querySelector('meta[name=theme-color]').remove()")
        try await expectPageColor(model, red: 16, green: 24, blue: 32)
    }

    private func expectPageColor(_ model: TextBrowserModel, red: CGFloat, green: CGFloat, blue: CGFloat) async throws {
        for _ in 0..<100 {
            var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
            if model.pageColor.getRed(&r, green: &g, blue: &b, alpha: &a),
               abs(r - red / 255) < 0.001, abs(g - green / 255) < 0.001, abs(b - blue / 255) < 0.001 {
                for background in [model.web.backgroundColor, model.web.scrollView.backgroundColor] {
                    let color = try #require(background)
                    #expect(color.getRed(&r, green: &g, blue: &b, alpha: &a))
                    #expect(abs(r - red / 255) < 0.001)
                    #expect(abs(g - green / 255) < 0.001)
                    #expect(abs(b - blue / 255) < 0.001)
                    #expect(abs(a - 1) < 0.001)
                }
                return
            }
            try await Task.sleep(for: .milliseconds(20))
        }
        Issue.record("Browser chrome did not follow the webpage color")
    }

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

@MainActor private final class BrowserInputChanges: NSObject, UITextInputDelegate {
    var textChanges = 0
    var selectionChanges = 0
    func textWillChange(_ textInput: (any UITextInput)?) { textChanges += 1 }
    func textDidChange(_ textInput: (any UITextInput)?) { textChanges += 1 }
    func selectionWillChange(_ textInput: (any UITextInput)?) { selectionChanges += 1 }
    func selectionDidChange(_ textInput: (any UITextInput)?) { selectionChanges += 1 }
    #if !targetEnvironment(macCatalyst)
    func conversationContext(_ context: UIConversationContext?, didChange textInput: (any UITextInput)?) {}
    #endif
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
