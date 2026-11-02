import SwiftUI
import Auth
import CryptoKit
import LeximoryCore

struct GuestSelection {
    let quote: String
    let context: String
    let offset: Int
    let title: String?
    let language: String
    var excerpt: String? {
        guard context.trimmingCharacters(in: .whitespacesAndNewlines) != quote.trimmingCharacters(in: .whitespacesAndNewlines),
              let range = Range(NSRange(location: offset, length: quote.utf16.count), in: context) else { return nil }
        let before = context[..<range.lowerBound].suffix(70)
        let after = context[range.upperBound...].prefix(110)
        return (before.startIndex > context.startIndex ? "…" : "") + String(before) + quote + String(after)
            + (after.endIndex < context.endIndex ? "…" : "")
    }
    var identity: String {
        SHA256.hash(data: Data([quote, context, String(offset)].joined(separator: "\n").utf8))
            .map { String(format: "%02x", $0) }.joined()
    }
}

@MainActor @Observable final class GuestSession {
    private(set) var allowance: GuestAllowance?
    private(set) var files: [String: LocalEbookInput] = [:]
    let api: GuestAIClient
    private let keychain = KeychainLocalStorage(service: "com.leximory.reader.guest")
    private let credentialKey: String
    private var credential: GuestCredential?
    private var enrolling: Task<GuestCredential, Error>?
    private var requests: [String: GuestDefinitionInput] = [:]
    private var languages: [String: String] = [:]

    init(baseURL: URL) {
        api = GuestAIClient(baseURL: baseURL)
        credentialKey = "guest.\(baseURL.host ?? "leximory")"
        credential = (try? keychain.retrieve(key: credentialKey)).flatMap { try? JSONDecoder().decode(GuestCredential.self, from: $0) }
        allowance = credential?.allowance
    }

    func openFile(_ file: BrowserEbookFile) throws -> LocalEbookInput {
        let input = try LocalEbookInput(data: file.data, filename: file.name)
        files[input.id] = input
        return input
    }

    func lookup(_ selection: GuestSelection) async throws -> AsyncThrowingStream<DefinitionEvent, Error> {
        let key = selection.identity
        let credential = try await credentialForRequest()
        let input: GuestDefinitionInput
        if let existing = requests[key] { input = existing }
        else {
            input = try GuestDefinitionInput(requestID: UUID().uuidString.lowercased(), quote: selection.quote,
                context: selection.context, offset: selection.offset)
            requests[key] = input
        }
        let events = api.definitions(input, token: credential.token)
        return AsyncThrowingStream { continuation in
            let task = Task { @MainActor in
                do {
                    for try await event in events {
                        if case .completed = event {
                            let result = try await MutationRetry.run { [api] in try await api.result(requestID: input.requestId, token: credential.token) }
                            guard result.state == .completed, let language = result.language else { throw URLError(.cannotParseResponse) }
                            allowance = result.allowance
                            languages[key] = language
                        }
                        continuation.yield(event)
                    }
                    continuation.finish()
                } catch {
                    if let result = try? await api.result(requestID: input.requestId, token: credential.token), result.state == .failed {
                        requests[key] = nil
                    } else if let failure = MobileClient.cause(of: error) as? MobileFailure, !failure.error.retryable { requests[key] = nil }
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    func language(for selection: GuestSelection) -> String { languages[selection.identity] ?? selection.language }

    private func credentialForRequest() async throws -> GuestCredential {
        if let credential, !credential.isExpired { return credential }
        if let enrolling { return try await enrolling.value }
        let task = Task { try await api.createSession() }
        enrolling = task
        defer { enrolling = nil }
        let credential = try await task.value
        try keychain.store(key: credentialKey, value: JSONEncoder().encode(credential))
        self.credential = credential; allowance = credential.allowance
        return credential
    }
}

extension EnvironmentValues {
    @Entry var guestSession: GuestSession? = nil
    @Entry var accountSession: AccountSession? = nil
}

extension DefinitionSource {
    func guestSelection(title: String?, language: String) throws -> GuestSelection {
        switch self {
        case .webpage(_, let selection, _, _):
            GuestSelection(quote: selection.quote, context: selection.context, offset: selection.offset, title: title, language: language)
        case .ebook(_, let quote, let context, let offset):
            GuestSelection(quote: quote, context: context, offset: offset, title: title, language: language)
        case .article, .browser: throw URLError(.unsupportedURL)
        }
    }
}
