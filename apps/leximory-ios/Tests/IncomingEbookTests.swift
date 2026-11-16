import Foundation
import Testing
@testable import Leximory

@MainActor struct IncomingEbookTests {
    #if os(iOS)
    @Test func appRegistersOnlyPDFAndEPUBForSystemFileOpening() throws {
        let types = try #require(Bundle.main.object(forInfoDictionaryKey: "CFBundleDocumentTypes") as? [[String: Any]])
        let identifiers = types.flatMap { $0["LSItemContentTypes"] as? [String] ?? [] }
        #expect(Set(identifiers) == ["com.adobe.pdf", "org.idpf.epub-container"])
        #expect(Bundle.main.object(forInfoDictionaryKey: "LSSupportsOpeningDocumentsInPlace") as? Bool == true)
    }
    #endif

    @Test(arguments: ["A shared book.PDF", "雨の庭.epub"])
    func sharedFileRetainsItsNameAndBytesAfterSourceDisappears(filename: String) async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let url = root.appending(path: filename)
        let bytes = Data([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff])
        try bytes.write(to: url)
        let inbox = IncomingEbookInbox()
        let loading = try #require(inbox.receive(url))
        await loading.value
        try FileManager.default.removeItem(at: url)

        #expect(inbox.nextID != nil)
        let file = try #require(inbox.takeNext()).get()
        #expect(file.name == filename)
        #expect(file.data == bytes)
        #expect(inbox.takeNext() == nil)
    }

    @Test func filesWaitInArrivalOrderUntilTheWorkspaceCanAcceptThem() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let firstURL = root.appending(path: "first.pdf")
        let secondURL = root.appending(path: "second.epub")
        try Data("first file".utf8).write(to: firstURL)
        try Data("second file".utf8).write(to: secondURL)
        let inbox = IncomingEbookInbox()
        let first = try #require(inbox.receive(firstURL))
        let second = try #require(inbox.receive(secondURL))
        await second.value
        await first.value

        let firstID = try #require(inbox.nextID)
        #expect(try #require(inbox.takeNext()).get().name == "first.pdf")
        #expect(inbox.nextID != firstID)
        #expect(try #require(inbox.takeNext()).get().name == "second.epub")
        #expect(inbox.nextID == nil)
    }

    @Test(arguments: [0, BrowserEbookFile.maximumSize + 1])
    func rejectsEmptyAndOversizedFiles(size: Int) async throws {
        let url = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString + ".pdf")
        defer { try? FileManager.default.removeItem(at: url) }
        try Data(repeating: 0, count: size).write(to: url)
        let inbox = IncomingEbookInbox()
        await inbox.receive(url)?.value

        let result = try #require(inbox.takeNext())
        #expect(throws: URLError(.dataLengthExceedsMaximum)) { try result.get() }
    }

    @Test func unreadableFileDoesNotBlockTheNextIncomingFile() async throws {
        let url = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString + ".pdf")
        let inbox = IncomingEbookInbox()
        await inbox.receive(url)?.value
        let failed = try #require(inbox.takeNext())
        #expect(throws: (any Error).self) { try failed.get() }

        try Data("next file".utf8).write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }
        await inbox.receive(url)?.value
        #expect(try #require(inbox.takeNext()).get().data == Data("next file".utf8))
    }

    @Test func leavesWebAndAuthenticationLinksToTheExistingRouter() throws {
        let inbox = IncomingEbookInbox()
        #expect(inbox.receive(try #require(URL(string: "https://leximory.com/book.pdf"))) == nil)
        #expect(inbox.receive(try #require(URL(string: "leximory://auth/callback?code=example"))) == nil)
        #expect(inbox.nextID == nil)
    }
}
