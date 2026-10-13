import Foundation
import Testing
import LeximoryCore
import OpenAPIRuntime
import HTTPTypes
@testable import Leximory

@MainActor struct BrowserWorkspaceTests {
    @Test func leavingAnArticleKeepsItsAnnotationActivityAndOpeningItAcknowledgesCompletion() async throws {
        let transport = WorkspaceTransport()
        let namespace = "workspace-test." + UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.annotations." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent-web." + namespace); UserDefaults.standard.removeObject(forKey: "recent-access." + namespace) }
        let workspace = BrowserWorkspaceModel(client: client(transport), namespace: namespace)
        let details = try await workspace.client.documentDetails(textID: "article")
        await workspace.imported(details.text, annotating: true)
        #expect(workspace.hasPending)
        workspace.visit(.home)
        await transport.complete()
        await workspace.poll()
        #expect(workspace.readyCount == 1)
        #expect(workspace.hasPending == false)
        #expect(workspace.completionID == nil)
        await workspace.open(details.text)
        #expect(workspace.readyCount == 0)
        #expect(workspace.current.textID == "article")
    }
    @Test func completionInTheCurrentArticleTriggersTheRevealWithoutAnUnreadCount() async throws {
        let transport = WorkspaceTransport()
        let namespace = "workspace-test." + UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.annotations." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent-web." + namespace); UserDefaults.standard.removeObject(forKey: "recent-access." + namespace) }
        let workspace = BrowserWorkspaceModel(client: client(transport), namespace: namespace)
        let details = try await workspace.client.documentDetails(textID: "article")
        await workspace.imported(details.text, annotating: true)
        await transport.complete()
        await workspace.poll()
        #expect(workspace.completionID == "article")
        #expect(workspace.readyCount == 0)
    }
    @Test func aLateOpenDoesNotReplaceANewerDestination() async throws {
        let transport = WorkspaceTransport()
        let namespace = "workspace-test." + UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.annotations." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent-web." + namespace); UserDefaults.standard.removeObject(forKey: "recent-access." + namespace) }
        let workspace = BrowserWorkspaceModel(client: client(transport), namespace: namespace)
        let details = try await workspace.client.documentDetails(textID: "article")
        await transport.delayNextRead()
        let open = Task { await workspace.open(details.text) }
        while await transport.calls < 2 { try await Task.sleep(for: .milliseconds(10)) }
        workspace.visit(.bookmarks)
        await open.value
        #expect(workspace.current.title == "我的书签")
        #expect(workspace.opening == false)
    }
    @Test func clearingHistoryRemovesWebKitHistoryWithoutRemovingAnnotationActivity() async throws {
        let transport = WorkspaceTransport()
        let namespace = "workspace-test." + UUID().uuidString
        defer { UserDefaults.standard.removeObject(forKey: "browser.annotations." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent." + namespace); UserDefaults.standard.removeObject(forKey: "browser.recent-web." + namespace); UserDefaults.standard.removeObject(forKey: "recent-access." + namespace) }
        let workspace = BrowserWorkspaceModel(client: client(transport), namespace: namespace)
        let details = try await workspace.client.documentDetails(textID: "article")
        await workspace.imported(details.text, annotating: true)
        let browser = workspace.browser
        workspace.clearHistory()
        #expect(workspace.browser !== browser)
        #expect(workspace.history.entries.count == 1)
        #expect(workspace.current.title == "Leximory")
        #expect(workspace.hasPending)
    }
    private func client(_ transport: WorkspaceTransport) -> MobileClient {
        MobileClient(baseURL: URL(string: "https://workspace.test")!, transport: transport, token: { _ in "verified" })
    }
    private actor WorkspaceTransport: ClientTransport {
        var calls = 0
        private var completed = false
        private var delayed = false
        func complete() { completed = true }
        func delayNextRead() { delayed = true }
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            calls += 1
            if delayed { delayed = false; try await Task.sleep(for: .milliseconds(200)) }
            guard operationID == "document" else { throw URLError(.unsupportedURL) }
            let status = completed ? "completed" : "annotating"
            let json = """
            {"text":{"id":"article","libraryId":"folder","title":"Along the river","topics":[],"emoji":null,"createdAt":null,"format":"article"},
             "library":{"id":"folder","name":"Reading","language":"en","owned":true,"archived":false,"shadow":false},"annotationProgress":"\(status)",
             "document":{"version":1,"revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","source":"Along the river.","blocks":[{"id":"block","kind":"paragraph","sourceRange":{"location":0,"length":16},"displayText":"Along the river.","spans":[]}]}}
            """
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(json))
        }
    }
}
