import Foundation
import Testing
import OpenAPIRuntime
import HTTPTypes
@testable import LeximoryCore

struct FolderClientTests {
    @Test func creationAndRenameUseTheTypedContractAndKeepTheFolderLanguage() async throws {
        let transport = FolderTransport()
        let client = MobileClient(baseURL: URL(string: "https://folder.test")!, transport: transport, token: { _ in "verified" })
        let folder = try await client.createFolder(name: "Reading", language: "ja", requestID: "request-one")
        #expect(folder.name == "Reading")
        #expect(folder.language == "ja")
        let renamed = try await client.renameFolder(libraryID: folder.id, name: "日本語")
        #expect(renamed.name == "日本語")
        #expect(renamed.language == "ja")
        #expect(await transport.operations == ["createFolder", "renameFolder"])
        #expect(await transport.inputs == [#"{"language":"ja","name":"Reading","requestId":"request-one"}"#, #"{"name":"日本語"}"#])
    }
    @Test func invalidLanguageNeverReachesTheTransport() async throws {
        let transport = FolderTransport()
        let client = MobileClient(baseURL: URL(string: "https://folder.test")!, transport: transport, token: { _ in "verified" })
        await #expect(throws: (any Error).self) { try await client.createFolder(name: "Test", language: "invalid", requestID: "request-one") }
        #expect(await transport.operations.isEmpty)
    }
    private actor FolderTransport: ClientTransport {
        var operations: [String] = []
        var inputs: [String] = []
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            #expect(request.headerFields[.authorization] == "Bearer verified")
            operations.append(operationID)
            let data = try await Data(collecting: try #require(body), upTo: 4096)
            let object = try JSONSerialization.jsonObject(with: data)
            inputs.append(String(decoding: try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys, .withoutEscapingSlashes]), as: UTF8.self))
            let name = operationID == "createFolder" ? "Reading" : "日本語"
            let json = "{\"id\":\"folder\",\"name\":\"\(name)\",\"language\":\"ja\",\"owned\":true,\"archived\":false,\"shadow\":false}"
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(json))
        }
    }
}
