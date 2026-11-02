import Foundation
import Testing
import HTTPTypes
import OpenAPIRuntime
@testable import LeximoryCore

struct GuestAccessTests {
    @Test func contextualInputBoundsUnicodeWithoutBreakingTheSelection() throws {
        let before = String(repeating: "👨‍👩‍👧‍👦", count: 1000)
        let context = before + "riverbank" + String(repeating: "🌱", count: 1000)
        let input = try GuestDefinitionInput(requestID: UUID().uuidString, quote: "riverbank", context: context, offset: before.utf16.count)
        #expect(input.context.utf16.count <= 4000)
        let range = try #require(Range(NSRange(location: input.offset, length: 9), in: input.context))
        #expect(input.context[range] == "riverbank")
        #expect(input.context.contains("�") == false)
        #expect(throws: URLError.self) { try GuestDefinitionInput(requestID: "test", quote: "bank", context: "bank", offset: -1) }
        #expect(throws: URLError.self) { try GuestDefinitionInput(requestID: "test", quote: "bank", context: "bank", offset: Int.max) }
    }

    @Test func localBooksNeedNoAccountAndRejectOversizedOrMislabeledFiles() throws {
        let input = try LocalEbookInput(data: Data("%PDF-1.7\nlocal".utf8), filename: "River path.pdf")
        #expect(input.document.text.title == "River path")
        #expect(input.book.data == Data("%PDF-1.7\nlocal".utf8))
        #expect(input.document.library.owned == false)
        #expect(throws: URLError.self) { try LocalEbookInput(data: Data("<html>".utf8), filename: "book.pdf") }
        #expect(throws: URLError.self) { try LocalEbookInput(data: Data(repeating: 0, count: 4_718_593), filename: "book.epub") }
    }

    @Test func guestLookupRetriesTheSameIdentityWithoutAccountAuthorization() async throws {
        let transport = GuestTransport()
        let client = GuestAIClient(baseURL: URL(string: "https://leximory.example")!, transport: transport)
        let credential = try await client.createSession()
        let input = try GuestDefinitionInput(requestID: "fa6ee154-4b6e-4aac-aa0e-9cc6f011c443", quote: "bank", context: "the bank", offset: 4)
        var definition: Definition?
        for try await event in client.definitions(input, token: credential.token) {
            if case .completed(_, let value) = event { definition = value }
        }
        #expect(definition?.definition == "河岸")
        #expect(await transport.identities == [input.requestId, input.requestId])
        #expect(credential.allowance.limit == 5)
    }

    @Test func savedWordAndDeletionUseTheirGeneratedAuthenticatedContracts() async throws {
        let transport = AccountTransport()
        let account = MobileClient(baseURL: URL(string: "https://leximory.example")!, transport: transport, token: { _ in "account-token" })
        let saved = try await account.createVocabulary(requestID: "fa6ee154-4b6e-4aac-aa0e-9cc6f011c443", language: "fr",
            fields: VocabularyFields(original: "bonjour", definition: Definition(lemma: "bonjour", definition: "你好")))
        #expect(saved.id == "word")
        let receipt = try await account.deleteAccount(requestID: "fa6ee154-4b6e-4aac-aa0e-9cc6f011c443", receiptToken: String(repeating: "a", count: 64), expectedUserID: "11111111-1111-4111-8111-111111111111")
        #expect(receipt.status == .pending)
        let status = MobileClient(baseURL: URL(string: "https://leximory.example")!, transport: transport, token: { _ in String(repeating: "a", count: 64) })
        #expect(try await status.accountDeletionStatus(requestID: receipt.requestId).status == .pending)
        #expect(try await status.retryAccountDeletion(requestID: receipt.requestId).status == .pending)
        #expect(await transport.operations == ["createVocabulary", "accountDeletion", "accountDeletionStatus", "accountDeletionRetry"])
    }
    @Test func deletionPurgesOnlyItsAccountAndPreventsLateWrites() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = URL(string: "https://local-cleanup.invalid")!
        let first = try LocalReadingStore(root: root, origin: origin, accountID: "first")
        let second = try LocalReadingStore(root: root, origin: origin, accountID: "second")
        try await first.saveData(Data("first".utf8), for: "private")
        try await second.saveData(Data("second".utf8), for: "private")
        await first.close(preservingData: true)
        let preserved = try LocalReadingStore(root: root, origin: origin, accountID: "first")
        #expect(await preserved.data(for: "private") == Data("first".utf8))
        try await preserved.purge()
        await #expect(throws: CancellationError.self) { try await preserved.saveData(Data("late".utf8), for: "private") }
        let reopened = try LocalReadingStore(root: root, origin: origin, accountID: "first")
        #expect(await reopened.data(for: "private") == nil)
        #expect(await second.data(for: "private") == Data("second".utf8))
    }
    @Test func deletionReauthenticationKeepsTheValidAccountSession() async throws {
        let transport = ReauthenticationTransport()
        let client = MobileClient(baseURL: URL(string: "https://reauthentication.invalid")!, transport: transport,
            token: { _ in "valid-account-token" }, unauthorized: { _ in await transport.rejected() })
        do {
            _ = try await client.deleteAccount(requestID: "fa6ee154-4b6e-4aac-aa0e-9cc6f011c443",
                receiptToken: String(repeating: "a", count: 64), expectedUserID: "11111111-1111-4111-8111-111111111111")
            Issue.record("Deletion must require a fresh sign-in")
        } catch {
            #expect((MobileClient.cause(of: error) as? MobileFailure)?.error.code == "reauthentication_required")
        }
        #expect(await transport.rejections == 0)
    }
    private actor ReauthenticationTransport: ClientTransport {
        var rejections = 0
        func rejected() { rejections += 1 }
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            (.init(status: .unauthorized), HTTPBody(#"{"error":{"code":"reauthentication_required","message":"Verify your identity","retryable":false}}"#))
        }
    }

    private actor GuestTransport: ClientTransport {
        var identities: [String] = []
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            #expect(baseURL.path == "/api/mobile/v1")
            if request.path == "/guest/session" {
                #expect(request.headerFields[.authorization] == nil)
                return (.init(status: .ok), HTTPBody(#"{"token":"guest-token","expiresAt":"2099-11-01T00:00:00Z","allowance":{"used":0,"limit":5,"resetsAt":"2099-11-01T00:00:00Z"}}"#))
            }
            #expect(request.headerFields[.authorization] == "Bearer guest-token")
            let input = try JSONDecoder().decode(GuestDefinitionInput.self, from: await Data(collecting: #require(body), upTo: 32768))
            identities.append(input.requestId)
            if identities.count == 1 { throw URLError(.networkConnectionLost) }
            let frames = #"{"kind":"started","requestId":"fa6ee154-4b6e-4aac-aa0e-9cc6f011c443"}"# + "\n"
                + #"{"kind":"completed","requestId":"fa6ee154-4b6e-4aac-aa0e-9cc6f011c443","definition":{"lemma":"bank","definition":"河岸"}}"# + "\n"
            return (.init(status: .ok), HTTPBody(frames))
        }
    }
    private actor AccountTransport: ClientTransport {
        var operations: [String] = []
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            operations.append(operationID)
            if operationID == "createVocabulary" {
                #expect(request.headerFields[.authorization] == "Bearer account-token")
                struct Input: Decodable { let language: String; let fields: VocabularyFields }
                let input = try JSONDecoder().decode(Input.self, from: await Data(collecting: #require(body), upTo: 100000))
                #expect(input.language == "fr"); #expect(input.fields.original == "bonjour")
                return (.init(status: .ok), HTTPBody(#"{"id":"word","libraryId":"shadow-fr"}"#))
            }
            if operationID == "accountDeletion" {
                #expect(request.headerFields[.authorization] == "Bearer account-token")
                struct Input: Decodable { let requestId: String; let receiptToken: String; let expectedUserId: String }
                let input = try JSONDecoder().decode(Input.self, from: await Data(collecting: #require(body), upTo: 2048))
                #expect(input.receiptToken == String(repeating: "a", count: 64))
                #expect(input.expectedUserId == "11111111-1111-4111-8111-111111111111")
            } else {
                #expect(request.headerFields[.authorization] == "Bearer " + String(repeating: "a", count: 64))
                #expect(body == nil)
            }
            return (.init(status: .ok), HTTPBody(#"{"requestId":"fa6ee154-4b6e-4aac-aa0e-9cc6f011c443","status":"pending"}"#))
        }
    }
}
