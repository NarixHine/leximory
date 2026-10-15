import SwiftUI
import WebKit
import Testing
import LeximoryCore
import OpenAPIRuntime
import HTTPTypes
@testable import Leximory

@MainActor struct ArticleEditorTests {
    @Test func visualEditorPreservesAnnotationsAudioAndMarkdownWhenEditing() async throws {
        let source = "# River\n\nA {{bank||bank||河岸||古英语||embankment}} beside **water** and &&small&&.\n\n:::audio_123\nListen to the river.\n:::\n\n- First\n- Second"
        let session = try await open(source)
        defer { session.web.configuration.userContentController.removeScriptMessageHandler(forName: "editor") }
        #expect(try await session.controller.markdown() == source)
        let display = try await session.web.callAsyncJavaScript("return document.querySelector('.tiptap').innerText", arguments: [:], in: nil, contentWorld: .page) as? String
        #expect(display?.contains("bank") == true)
        #expect(display?.contains("{{") == false)
        #expect(display?.contains("||") == false)
        let edited = try await session.web.callAsyncJavaScript("""
            window.lexiEditor.insertText(' New words.');
            return window.lexiEditor.markdown();
            """, arguments: [:], in: nil, contentWorld: .page) as? String
        let markdown = try #require(edited)
        #expect(markdown.contains("{{bank||bank||河岸||古英语||embankment}}"))
        #expect(markdown.contains(":::audio_123"))
        #expect(markdown.contains("Listen to the river."))
        #expect(markdown.contains("&&small&&"))
        #expect(markdown.contains("**water**"))
        #expect(markdown.contains("New words."))
        _ = session.coordinator
    }
    @Test func unsupportedStructuresAndHostileHTMLRemainInertAndLossless() async throws {
        let table = "| A | B |\n|---|---|\n| x | y |"
        let ruby = "<ruby>漢<rt>かん</rt></ruby>"
        let source = "Before.\n\n\(table)\n\n\(ruby)\n\n![Cover](https://example.com/cover.jpg)\n\n<script>window.injected = true</script>\n\nAfter."
        let session = try await open(source)
        defer { session.web.configuration.userContentController.removeScriptMessageHandler(forName: "editor") }
        #expect(try await session.controller.markdown() == source)
        let safe = try await session.web.callAsyncJavaScript("return !window.injected && !document.querySelector('.tiptap script') && !document.querySelector('.tiptap [src]')", arguments: [:], in: nil, contentWorld: .page) as? Bool
        #expect(safe == true)
        let edited = try await session.web.callAsyncJavaScript("window.lexiEditor.insertText(' Added.'); return window.lexiEditor.markdown()", arguments: [:], in: nil, contentWorld: .page) as? String
        let markdown = try #require(edited)
        #expect(markdown.contains(table))
        #expect(markdown.contains(ruby))
        #expect(markdown.contains("![Cover](https://example.com/cover.jpg)"))
        #expect(markdown.contains("Added."))
        _ = session.coordinator
    }
    @Test(arguments: [390.0, 1024.0], [UIUserInterfaceStyle.light, .dark])
    func editorReflowsAtPhoneAndTabletWidths(width: Double, style: UIUserInterfaceStyle) async throws {
        let source = "# A long heading that wraps comfortably on a small screen\n\nA **bold** paragraph with *italic* words.\n\n> A quotation.\n\n- First item\n- Second item"
        let session = try await open(source)
        defer { session.web.configuration.userContentController.removeScriptMessageHandler(forName: "editor") }
        session.web.overrideUserInterfaceStyle = style
        session.web.frame = CGRect(x: 0, y: 0, width: width, height: 700)
        try await Task.sleep(for: .milliseconds(50))
        let fits = try await session.web.callAsyncJavaScript("return document.documentElement.scrollWidth <= window.innerWidth", arguments: [:], in: nil, contentWorld: .page) as? Bool
        #expect(fits == true)
        #expect(try await session.controller.markdown() == source)
        _ = session.coordinator
    }
    @Test func replacingABookDoesNotFlushThePreviousFilesPosition() async throws {
        var saved: [String] = []
        let saver = EbookPositionSaver { saved.append($0) }
        saver.schedule("old-cfi")
        await saver.suspend()
        saver.flush(); saver.schedule("late-old-cfi")
        try await Task.sleep(for: .milliseconds(20))
        #expect(saved.isEmpty)
        saver.resume(); saver.schedule("new-cfi"); saver.flush()
        try await Task.sleep(for: .milliseconds(20))
        #expect(saved == ["new-cfi"])
    }
    @Test func fileChangeWaitsForAnAlreadyStartedPositionWrite() async throws {
        var pending: CheckedContinuation<Void, Never>?
        var saved: [String] = []
        let saver = EbookPositionSaver { location in
            await withCheckedContinuation { pending = $0 }
            saved.append(location)
        }
        saver.schedule("old-cfi"); saver.flush()
        for _ in 0..<100 where pending == nil { await Task.yield() }
        let continuation = try #require(pending)
        var readyToReplace = false
        let change = Task { await saver.suspend(); readyToReplace = true }
        await Task.yield()
        #expect(readyToReplace == false)
        continuation.resume()
        await change.value
        #expect(readyToReplace)
        #expect(saved == ["old-cfi"])
        saver.flush()
        #expect(saved == ["old-cfi"])
    }
    @Test func editSheetFitsPhoneAndTabletWithoutExtraReaderControls() async throws {
        let client = MobileClient(baseURL: try #require(URL(string: "https://editor.test")), transport: EditorSheetTransport(), token: { _ in "test" })
        let source = try await client.editableText(id: "article")
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene)
        defer { window.isHidden = true; previous?.makeKey() }
        for (width, scheme) in [(390.0, ColorScheme.light), (820.0, ColorScheme.dark)] {
            let workspace = BrowserWorkspaceModel(client: client, namespace: "editor-snapshot")
            let host = UIHostingController(rootView: TextManagementSheet(text: source.text, workspace: workspace, playback: PlaybackController())
                .environment(\.colorScheme, scheme))
            window.rootViewController = host
            window.frame = CGRect(x: 0, y: 0, width: width, height: 844)
            window.makeKeyAndVisible()
            host.view.frame = CGRect(x: 0, y: 0, width: width, height: 844)
            try await Task.sleep(for: .milliseconds(500))
            host.view.layoutIfNeeded()
            let format = UIGraphicsImageRendererFormat(); format.scale = 1
            let image = UIGraphicsImageRenderer(bounds: host.view.bounds, format: format).image { _ in
                host.view.drawHierarchy(in: host.view.bounds, afterScreenUpdates: true)
            }
            let data = try #require(image.pngData())
            Attachment.record(data, named: "text-edit-\(Int(width))-\(scheme == .dark ? "dark" : "light").png")
            #expect(abs(image.size.width - width) < 1)
        }
    }
    private struct EditorSheetTransport: ClientTransport {
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            #expect(operationID == "editableText")
            let source = #"{"text":{"id":"article","libraryId":"folder","title":"Along the river: notes on a quieter morning","topics":["自然，阅读","Reading and reflections on quiet mornings beside the river"],"emoji":"🌿","createdAt":null,"format":"article"},"content":"A river runs through the garden.","revision":"initial","contentEditable":true}"#
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(source))
        }
    }
    private func open(_ source: String) async throws -> (web: WKWebView, controller: ArticleEditorController, coordinator: ArticleEditorWebView.Coordinator) {
        let controller = ArticleEditorController()
        let wrapper = ArticleEditorWebView(source: source, language: "English", fontSize: 17, controller: controller)
        let coordinator = wrapper.makeCoordinator()
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.add(coordinator, name: "editor")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 700), configuration: configuration)
        web.navigationDelegate = coordinator; controller.web = web
        let url = try #require(Bundle.main.url(forResource: "editor", withExtension: "html"))
        web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        for _ in 0..<500 {
            if controller.ready || controller.failed { break }
            try await Task.sleep(for: .milliseconds(20))
        }
        #expect(controller.failed == false)
        try #require(controller.ready)
        return (web, controller, coordinator)
    }
}
