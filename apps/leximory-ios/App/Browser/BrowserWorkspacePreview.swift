#if DEBUG && targetEnvironment(simulator)
import SwiftUI
import LeximoryCore
import OpenAPIRuntime
import HTTPTypes

struct BrowserWorkspacePreview: View {
    let playback: PlaybackController
    @State private var client: MobileClient?
    @State private var workspace: BrowserWorkspaceModel?
    @State private var pendingText: TextID?
    var body: some View {
        Group {
            if let client, let workspace { BrowserWorkspaceView(client: client, namespace: "workspace-fixture", playback: playback, pendingText: $pendingText, initialWorkspace: workspace) }
            else { ProgressView() }
        }.task {
            guard client == nil else { return }
            do {
                let payloads = try Self.payloads()
                let root = FileManager.default.temporaryDirectory.appending(path: "browser-workspace-fixture", directoryHint: .isDirectory)
                try? FileManager.default.removeItem(at: root)
                let origin = URL(string: "https://workspace-fixture.invalid")!
                let store = try LocalReadingStore(root: root, origin: origin, accountID: "fixture")
                let transport = BrowserWorkspaceFixtureTransport(payloads: payloads)
                let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "fixture" }, localStore: store)
                _ = try await client.allLibraries()
                for library in try await client.allLibraries() {
                    for text in try await client.allTexts(libraryID: library.id) {
                        _ = try await client.documentDetails(textID: text.id)
                        if text.format == "ebook", let descriptorData = payloads["ebook/" + text.id] {
                            let decoder = JSONDecoder()
                            decoder.dateDecodingStrategy = .iso8601
                            let descriptor = try decoder.decode(EbookDescriptor.self, from: descriptorData)
                            await store.save(descriptor, for: "ebook/" + text.id)
                            let filename = text.id == "workspace-japanese" ? "japanese-fixture.epub" : text.id == "workspace-pdf" ? "reader-fixture.pdf" : "reader-fixture.epub"
                            if let url = Bundle.main.url(forResource: filename, withExtension: nil) {
                                try await store.saveData(Data(contentsOf: url), for: "book/" + text.id)
                                await store.save(descriptor.url.absoluteString, for: "book-source/" + text.id)
                            }
                        }
                    }
                }
                UserDefaults.standard.removeObject(forKey: "browser.hidden-home-recents.workspace-fixture")
                UserDefaults.standard.removeObject(forKey: "browser.home-pins.workspace-fixture")
                UserDefaults.standard.removeObject(forKey: "browser.annotations.workspace-fixture")
                UserDefaults.standard.removeObject(forKey: "browser.recent.workspace-fixture")
                UserDefaults.standard.removeObject(forKey: "recent-access.workspace-fixture")
                let workspace = BrowserWorkspaceModel(client: client, namespace: "workspace-fixture")
                if ProcessInfo.processInfo.arguments.contains("--workspace-hold-annotations") {
                    await transport.setCompletionGate { [weak workspace] in workspace?.current.textID != "workspace-import" }
                }
                self.workspace = workspace
                self.client = client
            } catch { assertionFailure("Browser workspace fixture could not be prepared: \(error)") }
        }
    }
    static func payloads() throws -> [String: Data] {
        func encode(_ object: Any) throws -> Data { try JSONSerialization.data(withJSONObject: object) }
        let folder: [String: Any] = ["id": "workspace-folder", "name": "Field notes", "language": "en", "owned": true, "archived": false, "shadow": false]
        let japanese: [String: Any] = ["id": "workspace-japanese-folder", "name": "日本語", "language": "ja", "owned": true, "archived": false, "shadow": false]
        let archive: [String: Any] = ["id": "workspace-archive", "name": "Past reading", "language": "en", "owned": true, "archived": true, "shadow": false]
        let samples = FixtureLibrary.samples[0].articles
        var rows: [[String: Any]] = samples.map { ["id": $0.id.rawValue, "libraryId": "workspace-folder", "title": $0.title, "topics": $0.topics, "emoji": NSNull(), "createdAt": NSNull(), "format": "article"] }
        let epub: [String: Any] = ["id": "workspace-epub", "libraryId": "workspace-folder", "title": "A river journey", "topics": [], "emoji": NSNull(), "createdAt": NSNull(), "format": "ebook"]
        let pdf: [String: Any] = ["id": "workspace-pdf", "libraryId": "workspace-folder", "title": "River pages", "topics": [], "emoji": NSNull(), "createdAt": NSNull(), "format": "ebook"]
        let ja: [String: Any] = ["id": "workspace-japanese", "libraryId": "workspace-japanese-folder", "title": "日本語の本", "topics": [], "emoji": NSNull(), "createdAt": NSNull(), "format": "ebook"]
        rows += [epub, pdf]
        var payloads = ["libraries": try encode(["items": [folder, japanese, archive], "nextCursor": NSNull()]),
            "texts/workspace-folder": try encode(["items": rows, "nextCursor": NSNull()]),
            "texts/workspace-japanese-folder": try encode(["items": [ja], "nextCursor": NSNull()]),
            "texts/workspace-archive": try encode(["items": [], "nextCursor": NSNull()]),
            "browserRules": try encode(["items": []]), "vocabularyList": try encode(["items": [], "nextCursor": NSNull()])]
        for (index, article) in samples.enumerated() {
            guard let url = Bundle.main.url(forResource: article.resource, withExtension: "json") else { throw CocoaError(.fileNoSuchFile) }
            payloads["document/" + article.id.rawValue] = try encode(["text": rows[index], "library": folder,
                "document": try JSONSerialization.jsonObject(with: Data(contentsOf: url)), "annotationProgress": NSNull()])
        }
        for (text, library, format) in [(epub, folder, "epub"), (pdf, folder, "pdf"), (ja, japanese, "epub")] {
            guard let id = text["id"] as? String else { continue }
            payloads["document/" + id] = try encode(["text": text, "library": library, "document": NSNull(), "annotationProgress": NSNull()])
            payloads["ebook/" + id] = try encode(["text": text, "library": library, "url": "https://workspace-fixture.invalid/books/\(id).\(format)", "format": format,
                "expiresAt": "2099-01-01T00:00:00Z", "location": NSNull(), "bookmarks": []])
        }
        return payloads
    }
}

private actor BrowserWorkspaceFixtureTransport: ClientTransport {
    private let review = ReviewFixtureTransport()
    var payloads: [String: Data]
    private var pendingReads = 0
    private var completionGate: (@MainActor @Sendable () -> Bool)?
    init(payloads: [String: Data]) { self.payloads = payloads }
    func setCompletionGate(_ gate: @escaping @MainActor @Sendable () -> Bool) { completionGate = gate }
    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        if operationID == "review" { return try await review.send(request, body: body, baseURL: baseURL, operationID: operationID) }
        let path = (request.path ?? "").split(separator: "?")[0].split(separator: "/").map(String.init)
        var key = operationID
        if operationID == "texts", path.count >= 2 { key += "/" + path[path.count - 2] }
        if operationID == "document", let id = path.last { key += "/" + id }
        if operationID == "ebook", path.count >= 2 { key += "/" + path[path.count - 2] }
        if operationID == "importArticle" || operationID == "createBookmark" {
            guard let body else { throw URLError(.badServerResponse) }
            let input = try await JSONSerialization.jsonObject(with: Data(collecting: body, upTo: 65536)) as? [String: Any] ?? [:]
            let folderID = path[path.count - 2]
            let text: [String: Any] = ["id": "workspace-import", "libraryId": folderID, "title": input["title"] ?? "A quiet forest", "topics": [], "emoji": NSNull(), "createdAt": NSNull(),
                "format": operationID == "createBookmark" ? "bookmark" : "article", "bookmarkURL": input["url"] ?? NSNull()]
            let folder: [String: Any] = ["id": folderID, "name": "Field notes", "language": "en", "owned": true, "archived": false, "shadow": false]
            guard let documentData = payloads["document/fixture-reader"], let document = try JSONSerialization.jsonObject(with: documentData) as? [String: Any] else { throw URLError(.badServerResponse) }
            payloads["document/workspace-import"] = try JSONSerialization.data(withJSONObject: ["text": text, "library": folder, "document": operationID == "createBookmark" ? NSNull() : document["document"] ?? NSNull(), "annotationProgress": operationID == "createBookmark" ? NSNull() : "annotating"])
            pendingReads = 0
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(try JSONSerialization.data(withJSONObject: text)))
        }
        if key == "document/workspace-import", let data = payloads[key], var document = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            pendingReads += 1
            let mayComplete = await completionGate?() ?? true
            if pendingReads > 3 && mayComplete { document["annotationProgress"] = "completed" }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(try JSONSerialization.data(withJSONObject: document)))
        }
        if operationID == "browserRule" || operationID == "ebookPosition" { return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody("{\"saved\":true}")) }
        guard let data = payloads[key] else { throw URLError(.unsupportedURL) }
        return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(data))
    }
}
#endif
