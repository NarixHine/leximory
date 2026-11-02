import Foundation
import PDFKit
import SwiftUI
import LeximoryCore
import OpenAPIRuntime
import HTTPTypes
import Testing
import UIKit
@testable import Leximory

@MainActor @Suite(.timeLimit(.minutes(1))) struct EbookImportTests {
    @Test func epubUsesEmbeddedTitleAndContentInsteadOfDownloadFilename() async throws {
        let url = try #require(Bundle.main.url(forResource: "reader-fixture", withExtension: "epub"))
        let metadata = await EbookImportMetadata.read(.init(name: "download_938402.epub", data: try Data(contentsOf: url)))
        #expect(!metadata.title.isEmpty)
        #expect(metadata.title != "download 938402")
        #expect(!metadata.sample.isEmpty)
        #expect(metadata.sample.count <= 8000)
    }
    @Test func pdfReadsDocumentMetadataAndPageText() async {
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 320, height: 480), format: {
            let format = UIGraphicsPDFRendererFormat()
            format.documentInfo = [kCGPDFContextTitle as String: "The River", kCGPDFContextAuthor as String: "M. Field"]
            return format
        }())
        let data = renderer.pdfData { context in
            context.beginPage()
            ("A quiet river runs through the valley." as NSString).draw(at: CGPoint(x: 20, y: 30), withAttributes: [.font: UIFont.systemFont(ofSize: 16)])
        }
        let metadata = await EbookImportMetadata.read(.init(name: "download.pdf", data: data))
        #expect(metadata.title == "The River")
        #expect(metadata.author == "M. Field")
        #expect(metadata.sample.contains("quiet river"))
    }
    @Test(arguments: ["title", "folder"])
    func userInputCancelsOnlyItsOwnSuggestionAndRejectsLateResults(field: String) async {
        let draft = EbookImportDraft(filename: "download.epub")
        let gate = SuggestionGate()
        let filling = Task {
            await draft.fill(metadata: .init(title: "Original title"), reduceMotion: true) { field in
                await gate.wait(field)
            }
        }
        await gate.started()
        if field == "title" { draft.takeTitle(); draft.title = "My title" }
        else { draft.takeFolder(); draft.folderID = "my-folder" }
        gate.finish()
        await filling.value
        #expect(draft.title == (field == "title" ? "My title" : "Suggested title"))
        #expect(draft.folderID == (field == "folder" ? "my-folder" : "suggested-folder"))
    }
    @Test func dismissalAndSubmissionPreventAllLateAutofill() async {
        let draft = EbookImportDraft(filename: "Original.epub")
        let gate = SuggestionGate()
        let filling = Task { await draft.fill(metadata: .init(), reduceMotion: false) { await gate.wait($0) } }
        await gate.started()
        draft.stop(); gate.finish()
        await filling.value
        #expect(draft.title == "Original")
        #expect(draft.folderID == nil)
    }
    @Test func typingBeforeMetadataArrivesKeepsTheDraft() async {
        let draft = EbookImportDraft(filename: "Original.epub")
        draft.takeTitle(); draft.title = "My title"
        await draft.fill(metadata: .init(title: "Embedded title"), reduceMotion: true) { field in
            field == "folder" ? "suggested-folder" : "Suggested title"
        }
        #expect(draft.title == "My title")
        #expect(draft.folderID == "suggested-folder")
    }
}

@MainActor private final class SuggestionGate {
    private var pending: [String: CheckedContinuation<String?, Never>] = [:]
    private var ready: CheckedContinuation<Void, Never>?
    func wait(_ field: String) async -> String? {
        await withCheckedContinuation { continuation in
            pending[field] = continuation
            if pending.count == 2 { ready?.resume(); ready = nil }
        }
    }
    func started() async {
        if pending.count == 2 { return }
        await withCheckedContinuation { ready = $0 }
    }
    func finish() {
        pending["title"]?.resume(returning: "Suggested title")
        pending["folder"]?.resume(returning: "suggested-folder")
        pending.removeAll()
    }
}

@MainActor @Suite(.serialized) struct EbookImportRenderingTests {
    @Test(arguments: ["phone-light", "ipad-dark", "phone-large"])
    func reviewHasEditableSuggestedNameAndFolder(scenario: String) async throws {
        let dark = scenario == "ipad-dark"
        let transport = EbookImportTestTransport()
        let client = MobileClient(baseURL: URL(string: "https://ebook-import.invalid")!, transport: transport, token: { _ in "fixture" })
        let workspace = BrowserWorkspaceModel(client: client, namespace: "ebook-import-render-test")
        for (id, name, language) in [("novels", "English novels", "en"), ("japanese", "日本文学", "ja")] {
            let data = try JSONSerialization.data(withJSONObject: ["id": id, "name": name, "language": language, "owned": true, "archived": false, "shadow": false])
            workspace.upsertFolder(try JSONDecoder().decode(CatalogLibrary.self, from: data))
        }
        let source = try #require(Bundle.main.url(forResource: "reader-fixture", withExtension: "epub"))
        let request = BrowserImportRequest(source: .ebook(.init(name: "download_938402.epub", data: try Data(contentsOf: source))))
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene)
        window.frame = CGRect(x: 0, y: 0, width: dark ? 834 : 390, height: dark ? 1194 : 844)
        window.overrideUserInterfaceStyle = dark ? .dark : .light
        let controller = UIHostingController(rootView: BrowserImportSheet(request: request, workspace: workspace) { _, _ in }
            .environment(\.horizontalSizeClass, dark ? .regular : .compact)
            .dynamicTypeSize(scenario == "phone-large" ? .accessibility2 : .large))
        window.rootViewController = controller; window.makeKeyAndVisible()
        defer { window.isHidden = true; window.rootViewController = nil }
        for _ in 0..<400 {
            if await transport.completed == 2 { break }
            try await Task.sleep(for: .milliseconds(50))
        }
        #expect(await transport.completed == 2)
        try await Task.sleep(for: .milliseconds(250))
        controller.view.layoutIfNeeded()
        let image = UIGraphicsImageRenderer(bounds: window.bounds).image { _ in window.drawHierarchy(in: window.bounds, afterScreenUpdates: true) }
        let url = URL(filePath: "/private/tmp/leximory-ebook-import-\(scenario).png")
        try #require(image.pngData()).write(to: url)
        Attachment.record(try #require(image.pngData()), named: "ebook-import-\(scenario).png")
    }
}

private actor EbookImportTestTransport: ClientTransport {
    private(set) var completed = 0
    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        guard operationID == "suggestEbookImport", let body else { throw URLError(.unsupportedURL) }
        let data = try await Data(collecting: body, upTo: 64000)
        let input = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        let value = input?["field"] as? String == "folder" ? "novels" : "A River Journey: Notes from the Valley — M. Field"
        completed += 1
        return (.init(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(try JSONSerialization.data(withJSONObject: ["value": value])))
    }
}
