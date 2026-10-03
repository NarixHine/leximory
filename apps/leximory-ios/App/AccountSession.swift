import Foundation
import Observation
import Auth
import LeximoryCore

struct AppConfiguration: Decodable, Sendable {
    let apiURL: URL
    let supabaseURL: URL
    let anonKey: String
    private var allowedAPIURL: Bool {
        if apiURL.scheme == "https" { return true }
        #if DEBUG
        return apiURL.scheme == "http" && apiURL.host == "localhost" && apiURL.port == 3001
        #else
        return false
        #endif
    }
    static var bundled: AppConfiguration? {
        guard let url = Bundle.main.url(forResource: "Connection", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let config = try? JSONDecoder().decode(Self.self, from: data),
              config.allowedAPIURL, config.supabaseURL.scheme == "https",
              !config.anonKey.isEmpty else { return nil }
        return config
    }
}
actor AccountTokens {
    private let auth: AuthClient
    private var generation = 0
    private var signingIn: Task<Session, Error>?
    private var refresh: Task<String, Error>?
    init(configuration: AppConfiguration) {
        auth = AuthClient(url: configuration.supabaseURL.appending(path: "auth/v1"),
            headers: ["apikey": configuration.anonKey],
            storageKey: "leximory.session.\(configuration.supabaseURL.host ?? "project")",
            localStorage: KeychainLocalStorage(service: "com.leximory.reader.auth"),
            autoRefreshToken: false, emitLocalSessionAsInitialSession: false)
    }
    func token(rejected: String?) async throws -> String {
        let currentGeneration = generation
        let session = try await auth.session
        guard generation == currentGeneration else { throw CancellationError() }
        if rejected == nil || rejected != session.accessToken { return session.accessToken }
        if let refresh { return try await refresh.value }
        let task = Task { try await auth.refreshSession().accessToken }
        refresh = task
        defer { if generation == currentGeneration { refresh = nil } }
        let token = try await task.value
        guard generation == currentGeneration else { throw CancellationError() }
        return token
    }
    func signIn(email: String, password: String) async throws {
        let currentGeneration = generation
        let task = Task { try await auth.signIn(email: email, password: password) }
        signingIn = task
        defer { if generation == currentGeneration { signingIn = nil } }
        _ = try await task.value
        guard generation == currentGeneration else { throw CancellationError() }
    }
    func matches(_ rejected: String) -> Bool { auth.currentSession?.accessToken == rejected }
    func signOut() async {
        generation += 1
        let refreshing = refresh
        refresh = nil
        refreshing?.cancel()
        if let refreshing { _ = await refreshing.result }
        signingIn?.cancel()
        if let signingIn { _ = await signingIn.result }
        signingIn = nil
        try? await auth.signOut(scope: .local)
    }
}

@MainActor @Observable final class AccountSession {
    enum State {
        case restoring, signedOut, expired, signedIn(Account), unavailable(String)
        var accountID: String? { if case .signedIn(let account) = self { return account.userId }; return nil }
    }
    private(set) var state: State = .restoring
    private(set) var generation = 0
    let tokens: AccountTokens
    private let configuration: AppConfiguration
    @ObservationIgnored lazy var client = MobileClient(baseURL: configuration.apiURL, token: { [tokens, weak self] rejected in
        let current = await self?.generation
        do { return try await tokens.token(rejected: rejected) }
        catch {
            if Self.requiresSignIn(error), let current { await self?.expire(generation: current) }
            throw error
        }
    }, unauthorized: { [weak self] rejected in
        await self?.expire(rejected: rejected)
    })
    init(configuration: AppConfiguration) {
        let tokens = AccountTokens(configuration: configuration)
        self.tokens = tokens
        self.configuration = configuration
    }
    func restore() async {
        let current = generation
        do {
            let account = try await client.account()
            guard generation == current, !Task.isCancelled else { return }
            state = .signedIn(account)
        } catch {
            guard generation == current, !Task.isCancelled else { return }
            let cause = MobileClient.cause(of: error)
            if Self.requiresSignIn(cause) { state = .signedOut }
            else if let failure = cause as? MobileFailure, failure.error.code == "unauthenticated" { state = .signedOut }
            else { state = .unavailable("暂时无法连接文库，请稍后重试。") }
        }
    }
    func signIn(email: String, password: String) async throws {
        let current = generation
        try await tokens.signIn(email: email, password: password)
        let account = try await client.account()
        guard generation == current, !Task.isCancelled else { throw CancellationError() }
        state = .signedIn(account)
    }
    func refreshAccount() async {
        let current = generation
        guard state.isSignedIn else { return }
        do {
            let account = try await client.account()
            guard generation == current, state.isSignedIn, !Task.isCancelled else { return }
            state = .signedIn(account)
        } catch { }
    }
    nonisolated static func requiresSignIn(_ error: any Error) -> Bool {
        guard let authError = error as? AuthError else { return false }
        return [ErrorCode.sessionNotFound, .sessionExpired, .refreshTokenNotFound, .refreshTokenAlreadyUsed, .badJWT, .invalidJWT, .userBanned].contains(authError.errorCode)
    }
    private func expire(generation current: Int) async {
        guard generation == current, state.isSignedIn else { return }
        generation += 1
        let expiredGeneration = generation
        state = .restoring
        await tokens.signOut()
        guard generation == expiredGeneration else { return }
        state = .expired
    }
    private func expire(rejected: String) async {
        let current = generation
        guard await tokens.matches(rejected), generation == current else { return }
        await expire(generation: current)
    }
    func signOut() async {
        generation += 1
        state = .restoring
        await tokens.signOut()
        state = .signedOut
    }
}
