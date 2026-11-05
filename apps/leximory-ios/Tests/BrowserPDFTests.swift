import Foundation
import Network
import Testing
import UIKit
import WebKit
@testable import Leximory

@MainActor @Suite(.serialized) struct BrowserPDFTests {
    @Test func responseTypeDetectsExtensionlessPDFAndOriginalDownloadKeepsWebsiteCookies() async throws {
        let data = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 320, height: 480)).pdfData { context in
            context.beginPage()
            ("Original PDF" as NSString).draw(at: CGPoint(x: 24, y: 24), withAttributes: nil)
        }
        let server = try await PDFTestServer(data: data)
        defer { server.listener.cancel() }
        let fixture = try pdfBrowser()
        defer { fixture.cleanup() }
        let browser = fixture.model
        let host = try WebViewTestHost(browser.web)
        defer { host.close() }
        let cookie = try #require(HTTPCookie(properties: [.domain: "127.0.0.1", .path: "/", .name: "LeximoryPDFTest", .value: "verified"]))
        await browser.web.configuration.websiteDataStore.httpCookieStore.setCookie(cookie)
        browser.load(server.url)
        try await WebViewTestHost.waitUntil { (browser.isPDF && !browser.loading) || browser.error != nil }
        try #require(browser.isPDF)
        #expect(browser.url?.pathExtension == "")
        let file = try await browser.pdfFile()
        #expect(file.name == "Original document.pdf")
        #expect(file.data == data)
        let request = BrowserImportRequest(source: .pdf(file))
        #expect(request.title == "保存 PDF")
        #expect(request.confirmation == "保存")
        #expect(BrowserImportRequest(source: .ebook(file)).title == "打开电子书")
        browser.load(server.url.deletingLastPathComponent().appending(path: "actually-html.pdf"))
        try await WebViewTestHost.waitUntil { (browser.url?.path == "/actually-html.pdf" && !browser.loading) || browser.error != nil }
        try #require(browser.url?.path == "/actually-html.pdf" && !browser.loading)
        #expect(browser.isPDF == false)
    }

    @Test func oversizedPDFIsRejectedBeforeChoosingADestination() async throws {
        let server = try await PDFTestServer(data: Data("%PDF-1.7".utf8), length: BrowserEbookFile.maximumSize + 1)
        defer { server.listener.cancel() }
        let fixture = try pdfBrowser()
        defer { fixture.cleanup() }
        let browser = fixture.model
        let host = try WebViewTestHost(browser.web)
        defer { host.close() }
        let cookie = try #require(HTTPCookie(properties: [.domain: "127.0.0.1", .path: "/", .name: "LeximoryPDFTest", .value: "verified"]))
        await browser.web.configuration.websiteDataStore.httpCookieStore.setCookie(cookie)
        browser.load(server.url.deletingLastPathComponent().appending(path: "article"))
        try await WebViewTestHost.waitUntil { (browser.url?.path == "/article" && !browser.loading) || browser.error != nil }
        try #require(browser.url?.path == "/article" && !browser.loading)
        await #expect(throws: URLError(.dataLengthExceedsMaximum)) {
            try await BrowserPDFDownload().file(from: browser.web, url: server.url)
        }
    }
    private func pdfBrowser() throws -> (model: TextBrowserModel, cleanup: () -> Void) {
        let suite = "BrowserPDFTests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        var choice = BrowserBlockingPreferences()
        choice.enabled = false
        defaults.set(try JSONEncoder().encode(choice), forKey: BrowserAdBlocker.preferencesKey)
        let blocker = BrowserAdBlocker(defaults: defaults)
        let model = TextBrowserModel(websiteDataStore: .nonPersistent(), adBlocker: blocker)
        return (model, { defaults.removePersistentDomain(forName: suite) })
    }

}

private final class PDFTestServer {
    let listener: NWListener
    let url: URL

    init(data: Data, length: Int? = nil) async throws {
        let listener = try NWListener(using: .tcp, on: .any)
        self.listener = listener
        let pdf = Data("HTTP/1.1 200 OK\r\nContent-Type: application/pdf\r\nContent-Disposition: inline; filename=\"Original document.pdf\"\r\nContent-Length: \(length ?? data.count)\r\nConnection: close\r\n\r\n".utf8) + data
        let html = Data("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK".utf8)
        let denied = Data("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".utf8)
        listener.newConnectionHandler = { connection in
            connection.start(queue: .global(qos: .userInitiated))
            connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { request, _, _, _ in
                let request = String(decoding: request ?? Data(), as: UTF8.self)
                let response = request.hasPrefix("GET /document ") ? request.contains("LeximoryPDFTest=verified") ? pdf : denied : html
                connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
            }
        }
        await withCheckedContinuation { continuation in
            listener.stateUpdateHandler = { state in if case .ready = state { continuation.resume() } }
            listener.start(queue: .global(qos: .userInitiated))
        }
        let port = try #require(listener.port)
        url = try #require(URL(string: "http://127.0.0.1:\(port.rawValue)/document"))
    }
}
