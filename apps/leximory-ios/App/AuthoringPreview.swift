#if DEBUG
import SwiftUI
import LeximoryCore
import OpenAPIRuntime
import HTTPTypes

struct AuthoringPreview: View {
    let playback: PlaybackController
    @State private var client = MobileClient(baseURL: URL(string: "https://authoring.invalid")!, transport: AuthoringPreviewTransport(), token: { _ in "fixture" })
    @State private var sync: NativeSync?
    @State private var prepared = false
    private let library = FixtureLibrary(id: LibraryID(rawValue: "library"), name: "测试文库", language: "English", articles: [], isRemote: true, owned: true)
    var body: some View {
        Group {
            if prepared {
                FixtureLibraryView(playback: playback, libraries: [library], client: client, recentNamespace: "authoring-fixtures")
            } else { ProgressView() }
        }
        .environment(\.nativeSync, sync)
        .task {
            if ProcessInfo.processInfo.arguments.contains("--offline") {
                do {
                    let origin = URL(string: "https://authoring.invalid")!
                    let store = try LocalReadingStore(root: FileManager.default.temporaryDirectory.appending(path: "offline-authoring-fixture"), origin: origin, accountID: "fixture")
                    let scoped = MobileClient(baseURL: origin, transport: AuthoringPreviewTransport(), token: { _ in "fixture" }, localStore: store)
                    _ = try await scoped.allVocabulary(libraryID: "library")
                    await store.setOnline(false)
                    client = scoped
                    sync = NativeSync(store: store, client: scoped)
                } catch { assertionFailure("Offline authoring fixture could not be prepared: \(error)") }
            }
            prepared = true
        }
    }
}
private actor AuthoringPreviewTransport: ClientTransport {
    private var word = #"{"id":"word","libraryId":"library","createdAt":"2026-10-04T00:00:00Z","protected":false,"fields":{"original":"banks","lemma":"bank","definition":"河岸","etymology":"古英语","cognates":"embankment"}}"#
    private var texts: [String] = []
    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        let output: String
        switch operationID {
        case "texts": output = "{\"items\":[\(texts.joined(separator: ","))],\"nextCursor\":null}"
        case "vocabularyList": output = "{\"items\":[\(word)],\"nextCursor\":null}"
        case "savedWord": output = word
        case "extractArticle": output = #"{"title":"导入测试","content":"Along the river."}"#
        case "editWord":
            guard let body else { throw URLError(.badServerResponse) }
            let data = try await Data(collecting: body, upTo: 65536)
            let fields = try JSONSerialization.jsonObject(with: data)
            word = String(decoding: try JSONSerialization.data(withJSONObject: ["id": "word", "libraryId": "library", "createdAt": "2026-10-04T00:00:00Z", "protected": false, "fields": fields]), as: UTF8.self)
            output = word
        case "importArticle":
            guard let body else { throw URLError(.badServerResponse) }
            let data = try await Data(collecting: body, upTo: 65536)
            let input = try JSONSerialization.jsonObject(with: data) as! [String: Any]
            output = String(decoding: try JSONSerialization.data(withJSONObject: ["id": "new-article", "libraryId": "library", "title": input["title"]!, "topics": [], "emoji": NSNull(), "createdAt": NSNull(), "format": "article"]), as: UTF8.self)
            texts = [output]
        case "document":
            output = #"{"text":{"id":"new-article","libraryId":"library","title":"导入测试","topics":[],"emoji":null,"createdAt":null,"format":"article"},"library":{"id":"library","name":"测试文库","language":"en","owned":true,"archived":false,"shadow":false},"annotationProgress":null,"document":{"version":1,"revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","source":"Along the river.","blocks":[{"id":"block","kind":"paragraph","sourceRange":{"location":0,"length":16},"displayText":"Along the river.","spans":[]}]}}"#
        default: throw URLError(.unsupportedURL)
        }
        return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(output))
    }
}
#endif
