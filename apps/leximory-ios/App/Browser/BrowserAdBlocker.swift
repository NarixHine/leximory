import CryptoKit
import Foundation
import Observation
import WebKit

struct BrowserBlockingPreferences: Codable, Hashable, Sendable {
    var enabled = true
    var excludedHosts: Set<String> = []

    func blocks(_ url: URL) -> Bool {
        enabled && Self.host(url).map { !excludedHosts.contains($0) } == true
    }

    static func host(_ url: URL) -> String? {
        guard ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
              var host = url.host?.lowercased(), !host.isEmpty else { return nil }
        while host.hasSuffix(".") { host.removeLast() }
        if host.contains(":"), !host.hasPrefix("[") { host = "[" + host + "]" }
        return host.isEmpty ? nil : host
    }

    static func topURLPattern(_ host: String) -> String {
        "^https?://" + NSRegularExpression.escapedPattern(for: host) + "\\.?(:[0-9]+)?/"
    }
}

@MainActor struct BrowserBlockingPolicy {
    let preferences: BrowserBlockingPreferences
    let lists: [WKContentRuleList]
}

@MainActor @Observable final class BrowserAdBlocker {
    static let shared = BrowserAdBlocker()
    static let preferencesKey = "browser.adBlocking.preferences.v1"
    private(set) var preferences: BrowserBlockingPreferences
    private(set) var revision = 0
    private(set) var unavailable = false
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let sources: @Sendable () throws -> [String]
    @ObservationIgnored private let compile: (String, String) async throws -> WKContentRuleList
    @ObservationIgnored private var pending: [BrowserBlockingPreferences: Task<BrowserBlockingPolicy, any Error>] = [:]
    @ObservationIgnored private var prepared: [BrowserBlockingPreferences: BrowserBlockingPolicy] = [:]

    init(defaults: UserDefaults = .standard,
         sources: @escaping @Sendable () throws -> [String] = BrowserAdBlocker.bundledSources,
         compile: ((String, String) async throws -> WKContentRuleList)? = nil) {
        self.defaults = defaults
        self.sources = sources
        self.compile = compile ?? { identifier, json in
            guard let store = WKContentRuleListStore.default() else { throw CocoaError(.fileReadUnknown) }
            if let cached = try? await store.contentRuleList(forIdentifier: identifier) { return cached }
            guard let list = try await store.compileContentRuleList(forIdentifier: identifier, encodedContentRuleList: json) else {
                throw CocoaError(.fileReadCorruptFile)
            }
            return list
        }
        preferences = Self.readPreferences(defaults)
    }

    func prepare(_ choice: BrowserBlockingPreferences) async throws -> BrowserBlockingPolicy {
        if !choice.enabled { return BrowserBlockingPolicy(preferences: choice, lists: []) }
        if let cached = prepared[choice] { return cached }
        if let task = pending[choice] { return try await task.value }
        let sources = sources
        let compile = compile
        let task = Task { @MainActor in
            let json = try await Task.detached { try Self.rules(sources(), excluding: choice.excludedHosts) }.value
            var lists: [WKContentRuleList] = []
            for source in json {
                let digest = SHA256.hash(data: Data(source.utf8)).map { String(format: "%02x", $0) }.joined()
                lists.append(try await compile("Leximory.Ads." + digest, source))
            }
            return BrowserBlockingPolicy(preferences: choice, lists: lists)
        }
        pending[choice] = task
        defer { pending[choice] = nil }
        let policy = try await task.value
        if prepared.count >= 3 { prepared.removeAll() }
        prepared[choice] = policy
        return policy
    }

    func currentPolicy() async throws -> BrowserBlockingPolicy {
        while true {
            let version = revision
            do {
                let result = try await prepare(preferences)
                guard version == revision else { continue }
                unavailable = false
                return result
            } catch {
                guard version == revision else { continue }
                unavailable = true
                throw error
            }
        }
    }

    func commit(_ policy: BrowserBlockingPolicy, expectedRevision: Int) throws {
        guard revision == expectedRevision else { throw CancellationError() }
        defaults.set(try JSONEncoder().encode(policy.preferences), forKey: Self.preferencesKey)
        preferences = policy.preferences
        revision += 1
        unavailable = false
    }

    func clearExceptions() {
        preferences.excludedHosts = []
        defaults.set(try? JSONEncoder().encode(preferences), forKey: Self.preferencesKey)
        revision += 1
    }

    static func clearExceptions(in defaults: UserDefaults) {
        var choice = readPreferences(defaults)
        choice.excludedHosts = []
        defaults.set(try? JSONEncoder().encode(choice), forKey: preferencesKey)
    }

    private static func readPreferences(_ defaults: UserDefaults) -> BrowserBlockingPreferences {
        defaults.data(forKey: preferencesKey).flatMap { try? JSONDecoder().decode(BrowserBlockingPreferences.self, from: $0) }
            ?? BrowserBlockingPreferences()
    }

    nonisolated static func rules(_ sources: [String], excluding hosts: Set<String>) throws -> [String] {
        guard !sources.isEmpty else { throw CocoaError(.fileReadCorruptFile) }
        return try sources.map { source in
            guard var rules = try JSONSerialization.jsonObject(with: Data(source.utf8)) as? [[String: Any]], !rules.isEmpty else {
                throw CocoaError(.fileReadCorruptFile)
            }
            if !hosts.isEmpty {
                rules.append(["trigger": ["url-filter": ".*", "if-top-url": hosts.sorted().map(BrowserBlockingPreferences.topURLPattern)],
                              "action": ["type": "ignore-previous-rules"]])
            }
            let data = try JSONSerialization.data(withJSONObject: rules, options: [.sortedKeys])
            return String(decoding: data, as: UTF8.self)
        }
    }

    nonisolated static func bundledSources() throws -> [String] {
        struct Manifest: Decodable {
            struct File: Decodable { let name: String; let sha256: String }
            let files: [File]
        }
        guard let url = Bundle.main.url(forResource: "ad-blocking-manifest", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }
        let manifest = try JSONDecoder().decode(Manifest.self, from: Data(contentsOf: url))
        return try manifest.files.map { file in
            guard let url = Bundle.main.url(forResource: file.name, withExtension: "json") else { throw CocoaError(.fileNoSuchFile) }
            let data = try Data(contentsOf: url)
            let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
            guard digest == file.sha256 else { throw CocoaError(.fileReadCorruptFile) }
            return String(decoding: data, as: UTF8.self)
        }
    }
}
