import CryptoKit
import Foundation
import Network
import Testing
import WebKit
@testable import Leximory

@MainActor @Suite(.serialized) struct BrowserAdBlockerTests {
    nonisolated private static let fixtureRules = """
    [{"trigger":{"url-filter":"/advertising[.]js"},"action":{"type":"block"}},
     {"trigger":{"url-filter":".*"},"action":{"type":"css-display-none","selector":".advertisement"}}]
    """

    @Test func bundledFiltersCompileAndContainNetworkAndCosmeticProtection() async throws {
        let sources = try BrowserAdBlocker.bundledSources()
        let source = try #require(sources.first)
        let rules = try #require(try JSONSerialization.jsonObject(with: Data(source.utf8)) as? [[String: Any]])
        #expect(rules.count > 100_000)
        #expect(rules.contains { ($0["action"] as? [String: Any])?["type"] as? String == "block" })
        #expect(rules.contains { ($0["action"] as? [String: Any])?["type"] as? String == "css-display-none" })
        let (blocker, defaults, suite) = try isolated()
        defer { defaults.removePersistentDomain(forName: suite) }
        let policy = try await blocker.currentPolicy()
        #expect(policy.lists.count == sources.count)
        #expect(policy.preferences.enabled)
    }

    @Test func preferencesPersistOnlyOnCommitAndClearingKeepsTheGlobalChoice() async throws {
        let (blocker, defaults, suite) = try isolated(sources: { [Self.fixtureRules] })
        defer { defaults.removePersistentDomain(forName: suite) }
        var draft = blocker.preferences
        draft.enabled = false
        draft.excludedHosts = ["example.com"]
        let prepared = try await blocker.prepare(draft)
        #expect(blocker.preferences == BrowserBlockingPreferences())
        #expect(defaults.data(forKey: BrowserAdBlocker.preferencesKey) == nil)
        try blocker.commit(prepared, expectedRevision: 0)
        let restored = BrowserAdBlocker(defaults: defaults)
        #expect(restored.preferences == draft)
        await TextBrowserModel.clearBrowsingData(in: .nonPersistent(), preferences: defaults)
        let cleared = BrowserAdBlocker(defaults: defaults)
        #expect(cleared.preferences.enabled == false)
        #expect(cleared.preferences.excludedHosts.isEmpty)
        #expect(restored.preferences.enabled == false)
    }

    @Test func exceptionsUseCompleteNormalizedHostBoundaries() throws {
        let choice = BrowserBlockingPreferences(excludedHosts: ["example.com", "[::1]"])
        for address in ["https://EXAMPLE.com./page", "http://example.com:8080/", "http://[::1]:8080/"] {
            #expect(choice.blocks(try #require(URL(string: address))) == false)
        }
        for address in ["https://www.example.com/", "https://example.com.evil.test/", "https://notexample.com/", "https://another.test/?host=example.com"] {
            #expect(choice.blocks(try #require(URL(string: address))))
        }
        #expect(BrowserBlockingPreferences.host(try #require(URL(string: "file:///example.com"))) == nil)
        let pattern = try NSRegularExpression(pattern: BrowserBlockingPreferences.topURLPattern("example.com"))
        #expect(pattern.firstMatch(in: "https://example.com.evil.test/", range: NSRange("https://example.com.evil.test/".startIndex..., in: "https://example.com.evil.test/")) == nil)
    }

    @Test func actualRequestsAndCosmeticRulesRespectExceptionsAndGlobalDisabling() async throws {
        let server = try await AdBlockingTestServer()
        defer { server.listener.cancel() }
        let (blocker, defaults, suite) = try isolated(sources: { [Self.fixtureRules] })
        defer { defaults.removePersistentDomain(forName: suite) }
        let model = TextBrowserModel(websiteDataStore: .nonPersistent(), adBlocker: blocker)
        try await load(model, url: server.url)
        #expect(server.paths.contains("/ordinary.js"))
        #expect(server.paths.contains("/advertising.js") == false)
        #expect(try await model.web.evaluateJavaScript("getComputedStyle(document.querySelector('.advertisement')).display") as? String == "none")
        #expect(try await model.web.evaluateJavaScript("window.ordinaryLoaded") as? Bool == true)

        var choice = blocker.preferences
        choice.excludedHosts.insert("127.0.0.1")
        try blocker.commit(try await blocker.prepare(choice), expectedRevision: blocker.revision)
        try await load(model, url: server.url.appending(queryItems: [.init(name: "pass", value: "exception")]))
        #expect(server.paths.filter { $0 == "/advertising.js" }.count == 2)
        #expect(try await model.web.evaluateJavaScript("getComputedStyle(document.querySelector('.advertisement')).display") as? String != "none")

        server.reset()
        let otherHost = try #require(URL(string: server.url.absoluteString.replacingOccurrences(of: "127.0.0.1", with: "localhost")))
        try await load(model, url: otherHost)
        #expect(server.paths.contains("/advertising.js") == false)

        choice.enabled = false
        try blocker.commit(try await blocker.prepare(choice), expectedRevision: blocker.revision)
        try await load(model, url: otherHost.appending(queryItems: [.init(name: "pass", value: "disabled")]))
        #expect(server.paths.filter { $0 == "/advertising.js" }.count == 2)
        #expect(model.web.configuration.userContentController.userScripts.isEmpty)
    }

    @Test func failedPreparationAndOldDraftCannotReplaceCommittedSettings() async throws {
        let (blocker, defaults, suite) = try isolated(sources: { throw CocoaError(.fileReadCorruptFile) })
        defer { defaults.removePersistentDomain(forName: suite) }
        await #expect(throws: (any Error).self) { try await blocker.currentPolicy() }
        #expect(blocker.unavailable)
        var disabled = blocker.preferences
        disabled.enabled = false
        let policy = try await blocker.prepare(disabled)
        let oldRevision = blocker.revision
        blocker.clearExceptions()
        #expect(throws: CancellationError.self) { try blocker.commit(policy, expectedRevision: oldRevision) }
        #expect(blocker.preferences.enabled)
        try blocker.commit(policy, expectedRevision: blocker.revision)
        #expect(blocker.preferences.enabled == false)
        #expect(blocker.unavailable == false)
    }

    @Test func concurrentPreparationCannotReenableProtectionAfterANewerDisable() async throws {
        let suite = "ad-blocker-race." + UUID().uuidString
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = try #require(WKContentRuleListStore.default())
        let list = try #require(try await store.compileContentRuleList(forIdentifier: UUID().uuidString,
            encodedContentRuleList: Self.fixtureRules))
        var waiting: CheckedContinuation<Void, Never>?
        var calls = 0
        let blocker = BrowserAdBlocker(defaults: defaults, sources: { [Self.fixtureRules] }, compile: { _, _ in
            calls += 1
            await withCheckedContinuation { waiting = $0 }
            return list
        })
        let first = Task { try await blocker.currentPolicy() }
        let second = Task { try await blocker.currentPolicy() }
        for _ in 0..<100 where waiting == nil { try await Task.sleep(for: .milliseconds(10)) }
        let continuation = try #require(waiting)
        try blocker.commit(try await blocker.prepare(BrowserBlockingPreferences(enabled: false)), expectedRevision: 0)
        continuation.resume()
        let results = try await [first.value, second.value]
        #expect(calls == 1)
        #expect(results.allSatisfy { $0.preferences.enabled == false && $0.lists.isEmpty })
        #expect(blocker.preferences.enabled == false)
    }

    @Test func disablingRemovesOnlyOwnedListsAndDoesNotReplayPostRequests() async throws {
        let server = try await AdBlockingTestServer()
        defer { server.listener.cancel() }
        let (blocker, defaults, suite) = try isolated(sources: { [Self.fixtureRules] })
        defer { defaults.removePersistentDomain(forName: suite) }
        let model = TextBrowserModel(websiteDataStore: .nonPersistent(), adBlocker: blocker)
        let store = try #require(WKContentRuleListStore.default())
        let unrelated = try #require(try await store.compileContentRuleList(forIdentifier: UUID().uuidString,
            encodedContentRuleList: "[{\"trigger\":{\"url-filter\":\"/ordinary[.]js\"},\"action\":{\"type\":\"block\"}}]"))
        model.web.configuration.userContentController.add(unrelated)
        var disabled = blocker.preferences
        disabled.enabled = false
        try blocker.commit(try await blocker.prepare(disabled), expectedRevision: blocker.revision)
        try await load(model, url: server.url)
        #expect(server.paths.contains("/ordinary.js") == false)
        #expect(server.paths.contains("/advertising.js"))
        let previous = model.navigationID
        _ = try await model.web.evaluateJavaScript("document.querySelector('form').submit()")
        try await wait(model, after: previous)
        #expect(model.canReloadForBlocking == false)
        #expect(server.posts == 1)
        #expect(try await model.web.evaluateJavaScript("document.querySelector('input').value") as? String == "keep my draft")
    }

    private func isolated(sources: @escaping @Sendable () throws -> [String] = BrowserAdBlocker.bundledSources) throws -> (BrowserAdBlocker, UserDefaults, String) {
        let suite = "ad-blocker-test." + UUID().uuidString
        let defaults = try #require(UserDefaults(suiteName: suite))
        return (BrowserAdBlocker(defaults: defaults, sources: sources), defaults, suite)
    }
    private func load(_ model: TextBrowserModel, url: URL) async throws {
        let previous = model.navigationID
        model.load(url)
        try await wait(model, after: previous)
    }
    private func wait(_ model: TextBrowserModel, after previous: UUID) async throws {
        for _ in 0..<300 {
            try await Task.sleep(for: .milliseconds(50))
            if model.navigationID != previous, !model.loading,
               (try? await model.web.evaluateJavaScript("document.readyState") as? String) == "complete" { return }
        }
        throw CocoaError(.executableRuntimeMismatch)
    }
}

private final class AdBlockingTestServer: @unchecked Sendable {
    let listener: NWListener
    let url: URL
    private let traffic: AdBlockingTraffic
    var paths: [String] { traffic.paths }
    var posts: Int { traffic.posts }
    func reset() { traffic.reset() }

    init() async throws {
        let listener = try NWListener(using: .tcp, on: .any)
        self.listener = listener
        let traffic = AdBlockingTraffic()
        self.traffic = traffic
        listener.newConnectionHandler = { connection in
            connection.start(queue: .global(qos: .userInitiated))
            connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, _, _ in
                Self.respond(connection, data: data, traffic: traffic)
            }
        }
        let port: UInt16 = try await withCheckedThrowingContinuation { continuation in
            listener.stateUpdateHandler = { [listener] state in
                switch state {
                case .ready:
                    listener.stateUpdateHandler = nil
                    if let port = listener.port { continuation.resume(returning: port.rawValue) }
                    else { continuation.resume(throwing: URLError(.cannotConnectToHost)) }
                case .failed(let error): listener.stateUpdateHandler = nil; continuation.resume(throwing: error)
                default: break
                }
            }
            listener.start(queue: .global(qos: .userInitiated))
        }
        url = try #require(URL(string: "http://127.0.0.1:\(port)/page"))
    }

    private static func respond(_ connection: NWConnection, data: Data?, traffic: AdBlockingTraffic) {
        let request = String(decoding: data ?? Data(), as: UTF8.self)
        let rawPath = request.split(separator: " ").dropFirst().first.map(String.init) ?? "/"
        let path = rawPath.components(separatedBy: "?")[0]
        traffic.record(path, post: request.hasPrefix("POST "))
        let body: String
        let type: String
        if path.hasSuffix(".js") { body = "window.ordinaryLoaded = true"; type = "text/javascript" }
        else {
            type = "text/html"
            body = """
            <html><head><meta name='viewport' content='width=device-width'></head><body>
            <p>Ordinary article</p><div class='advertisement'>Advertisement</div>
            <form method='post' action='/page'><input value='keep my draft'></form>
            <script src='/advertising.js'></script><script src='/ordinary.js'></script>
            \(path == "/frame" ? "" : "<iframe src='/frame'></iframe>")
            </body></html>
            """
        }
        let response = "HTTP/1.1 200 OK\r\nContent-Type: \(type)\r\nCache-Control: no-store\r\nContent-Length: \(body.utf8.count)\r\nConnection: close\r\n\r\n" + body
        connection.send(content: Data(response.utf8), completion: .contentProcessed { _ in connection.cancel() })
    }
}

private final class AdBlockingTraffic: @unchecked Sendable {
    private let lock = NSLock()
    private var requests: [String] = []
    private var postCount = 0
    var paths: [String] { lock.withLock { requests } }
    var posts: Int { lock.withLock { postCount } }
    func reset() { lock.withLock { requests = [] } }
    func record(_ path: String, post: Bool) {
        lock.withLock { requests.append(path); if post { postCount += 1 } }
    }
}
