import Foundation
import Observation
import Auth
import LeximoryCore
import OpenAPIRuntime
import os

struct AppConfiguration: Decodable, Sendable, Equatable {
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
    static let bundled = AppConfiguration.bundled.map { AccountTokens(configuration: $0) }
    private let auth: AuthClient
    private let configuration: AppConfiguration
    private let fetch: AuthClient.FetchHandler
    private var generation = 0
    private var signingIn: Task<Session, Error>?
    private var creatingAccount: Task<AuthResponse, Error>?
    private var callback: Task<Session, Error>?
    private var refresh: Task<Session, Error>?
    init(configuration: AppConfiguration, storage: any AuthLocalStorage = KeychainLocalStorage(service: "com.leximory.reader.auth"),
         fetch: @escaping AuthClient.FetchHandler = { try await URLSession.shared.data(for: $0) }) {
        self.configuration = configuration
        self.fetch = fetch
        auth = AuthClient(url: configuration.supabaseURL.appending(path: "auth/v1"),
            headers: ["apikey": configuration.anonKey],
            storageKey: "leximory.session.\(configuration.supabaseURL.host ?? "project")",
            localStorage: storage, fetch: fetch,
            autoRefreshToken: false, emitLocalSessionAsInitialSession: false)
    }
    func token(rejected: String?, expectedUserID: String? = nil) async throws -> String {
        let currentGeneration = generation
        let session = try await auth.session
        guard generation == currentGeneration else { throw CancellationError() }
        guard expectedUserID == nil || session.user.id.uuidString.lowercased() == expectedUserID?.lowercased() else { throw CancellationError() }
        if rejected == nil || rejected != session.accessToken { return session.accessToken }
        if let refresh {
            let refreshed = try await refresh.value
            guard generation == currentGeneration,
                  expectedUserID == nil || refreshed.user.id.uuidString.lowercased() == expectedUserID?.lowercased() else { throw CancellationError() }
            return refreshed.accessToken
        }
        let task = Task { try await auth.refreshSession() }
        refresh = task
        defer { if generation == currentGeneration { refresh = nil } }
        let refreshed = try await task.value
        guard generation == currentGeneration else { throw CancellationError() }
        guard expectedUserID == nil || refreshed.user.id.uuidString.lowercased() == expectedUserID?.lowercased() else { throw CancellationError() }
        return refreshed.accessToken
    }
    func signIn(email: String, password: String) async throws {
        let currentGeneration = generation
        let task = Task { try await auth.signIn(email: email, password: password) }
        signingIn = task
        defer { if generation == currentGeneration { signingIn = nil } }
        _ = try await task.value
        guard generation == currentGeneration else { throw CancellationError() }
    }
    func reauthenticate(email: String, password: String, expectedUserID: String) async throws {
        let currentGeneration = generation
        let isolated = AuthClient(url: configuration.supabaseURL.appending(path: "auth/v1"),
            headers: ["apikey": configuration.anonKey], storageKey: "reauthentication",
            localStorage: TransientAuthStorage(), fetch: fetch, autoRefreshToken: false, emitLocalSessionAsInitialSession: false)
        let task = Task {
            let session = try await isolated.signIn(email: email, password: password)
            guard generation == currentGeneration, session.user.id.uuidString.lowercased() == expectedUserID.lowercased() else {
                throw URLError(.userAuthenticationRequired)
            }
            return try await auth.setSession(accessToken: session.accessToken, refreshToken: session.refreshToken)
        }
        signingIn = task
        defer { if generation == currentGeneration { signingIn = nil } }
        _ = try await task.value
        guard generation == currentGeneration else { throw CancellationError() }
    }
    static let callbackURL = URL(string: "leximory://auth/callback")!
    static let recoveryCallbackURL = URL(string: "leximory://auth/callback?flow=recovery")!

    func signUp(email: String, password: String) async throws -> Bool {
        let currentGeneration = generation
        let task = Task { try await auth.signUp(email: email, password: password, redirectTo: Self.callbackURL) }
        creatingAccount = task
        defer { if generation == currentGeneration { creatingAccount = nil } }
        let response = try await task.value
        guard generation == currentGeneration else { throw CancellationError() }
        return response.session == nil
    }
    func resendConfirmation(email: String) async throws {
        try await auth.resend(email: email, type: .signup, emailRedirectTo: Self.callbackURL)
    }
    func sendPasswordRecovery(email: String) async throws {
        try await auth.resetPasswordForEmail(email, redirectTo: Self.recoveryCallbackURL)
    }
    func handleCallback(_ url: URL) async throws {
        generation += 1
        let currentGeneration = generation
        let refreshing = refresh; refresh = nil; refreshing?.cancel()
        if let refreshing { _ = await refreshing.result }
        let authenticating = signingIn; signingIn = nil; authenticating?.cancel()
        if let authenticating { _ = await authenticating.result }
        let creating = creatingAccount; creatingAccount = nil; creating?.cancel()
        if let creating { _ = await creating.result }
        let previous = callback; callback = nil; previous?.cancel()
        if let previous { _ = await previous.result }
        guard generation == currentGeneration else { throw CancellationError() }
        let task = Task { try await auth.session(from: url) }
        callback = task
        defer { if generation == currentGeneration { callback = nil } }
        _ = try await task.value
        guard generation == currentGeneration else { throw CancellationError() }
    }

    func updateUsername(_ username: String) async throws {
        _ = try await auth.update(user: UserAttributes(data: ["username": .string(username)]))
    }
    func updateAvatar(_ url: URL) async throws {
        _ = try await auth.update(user: UserAttributes(data: ["avatar_url": .string(url.absoluteString)]))
    }
    func updateEmail(_ email: String) async throws { _ = try await auth.update(user: UserAttributes(email: email)) }
    func updatePassword(_ password: String) async throws { _ = try await auth.update(user: UserAttributes(password: password)) }
    func cachedUserID() -> String? { auth.currentSession?.user.id.uuidString.lowercased() }
    func matches(_ rejected: String) -> Bool { auth.currentSession?.accessToken == rejected }
    func signOut() async {
        generation += 1
        let creating = creatingAccount
        creatingAccount = nil
        creating?.cancel()
        if let creating { _ = await creating.result }
        let handlingCallback = callback
        callback = nil
        handlingCallback?.cancel()
        if let handlingCallback { _ = await handlingCallback.result }
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

private struct TransientAuthStorage: AuthLocalStorage {
    func store(key: String, value: Data) throws { }
    func retrieve(key: String) throws -> Data? { nil }
    func remove(key: String) throws { }
}

struct SignInFailure: LocalizedError {
    enum Stage: String { case authentication, account, storage }
    let stage: Stage
    let underlying: any Error

    var errorDescription: String? {
        let cause = MobileClient.cause(of: underlying)
        if let auth = cause as? AuthError {
            switch auth.errorCode {
            case .invalidCredentials: return "邮箱或密码不正确，请重试或重设密码。"
            case .emailNotConfirmed: return "请先通过确认邮件验证邮箱，再登录。"
            case .userBanned: return "此账号暂时无法登录，请联系支持。"
            case .overRequestRateLimit: return "登录尝试过于频繁，请稍后重试。"
            default: break
            }
        }
        if MobileClient.isConnectionFailure(underlying) {
            return "暂时无法连接，请检查网络后重试。"
        }
        switch stage {
        case .authentication: return "暂时无法登录，请稍后重试。"
        case .account: return "暂时无法登录，请稍后重试。"
        case .storage: return "暂时无法登录，请稍后重试。"
        }
    }

    func log() {
        let cause = MobileClient.cause(of: underlying)
        let logger = Logger(subsystem: "com.leximory.reader", category: "sign-in")
        let code = (cause as? AuthError)?.errorCode.rawValue ?? (cause as? MobileFailure)?.error.code ?? "unclassified"
        logger.error("Sign-in failed: stage=\(stage.rawValue, privacy: .public) code=\(code, privacy: .public) domain=\((cause as NSError).domain, privacy: .public) number=\((cause as NSError).code)")
        if let decoding = cause as? DecodingError {
            let context: DecodingError.Context
            switch decoding {
            case .dataCorrupted(let value), .keyNotFound(_, let value), .typeMismatch(_, let value), .valueNotFound(_, let value): context = value
            @unknown default: return
            }
            let path = context.codingPath.map(\.stringValue).joined(separator: ".")
            logger.error("Sign-in decoding failed: stage=\(stage.rawValue, privacy: .public) path=\(path, privacy: .public)")
        }
    }
}

@MainActor @Observable final class AccountSession {
    enum State {
        case restoring, signedOut, expired, signedIn(Account), unavailable(String)
        var accountID: String? { if case .signedIn(let account) = self { return account.userId }; return nil }
    }
    private(set) var state: State = .restoring
    private(set) var generation = 0
    let membership = MembershipStore()
    let guest: GuestSession
    let deletion: AccountDeletionModel
    var entry: AccountEntryContext?
    var callbackFailure: String?
    private(set) var passwordRecovery = false
    private(set) var authCallbackRevision = 0
    private(set) var avatarRevision = 0
    let tokens: AccountTokens
    private let configuration: AppConfiguration
    @ObservationIgnored private let transport: (any ClientTransport)?
    private(set) var sync: NativeSync?
    @ObservationIgnored private var scopedClient: MobileClient?
    private var scopedAccountID: String?
    var client: MobileClient { scopedClient ?? onlineClient }
    @ObservationIgnored private lazy var onlineClient = makeClient()
    private func makeClient(store: LocalReadingStore? = nil, notesStore: PDFNotesStore? = nil, accountID: String? = nil) -> MobileClient {
        let token: @Sendable (String?) async throws -> String = { [tokens, weak self] rejected in
        let current = await self?.generation
        do { return try await tokens.token(rejected: rejected, expectedUserID: accountID) }
        catch {
            if Self.requiresSignIn(error), let current { await self?.expire(generation: current) }
            throw error
        }
        }
        let unauthorized: @Sendable (String) async -> Void = { [weak self] rejected in await self?.expire(rejected: rejected) }
        if let transport {
            return MobileClient(baseURL: configuration.apiURL, transport: transport, token: token, unauthorized: unauthorized, localStore: store, notesStore: notesStore)
        }
        return MobileClient(baseURL: configuration.apiURL, token: token, unauthorized: unauthorized, localStore: store, notesStore: notesStore)
    }
    init(configuration: AppConfiguration, tokens suppliedTokens: AccountTokens? = nil, transport: (any ClientTransport)? = nil) {
        let tokens = suppliedTokens ?? (configuration == AppConfiguration.bundled
            ? (AccountTokens.bundled ?? AccountTokens(configuration: configuration))
            : AccountTokens(configuration: configuration))
        self.tokens = tokens
        self.configuration = configuration
        self.transport = transport
        guest = GuestSession(baseURL: configuration.apiURL)
        deletion = AccountDeletionModel(baseURL: configuration.apiURL)
    }
    func restore() async {
        var current = generation
        let tokenAccountID = await tokens.cachedUserID()
        if let scopedAccountID, scopedAccountID != tokenAccountID {
            membership.stop(); generation += 1; current = generation; state = .restoring
            await clearStore(preservingReading: true)
        }
        if await tokens.cachedUserID() == nil {
            guard generation == current, !Task.isCancelled else { return }
            await clearStore()
            state = .signedOut
            return
        }
        do {
            if scopedClient == nil, let id = await tokens.cachedUserID() { try await openStore(accountID: id) }
            if let cached = await client.localStore?.value(Account.self, for: "account"),
               generation == current, !Task.isCancelled {
                state = .signedIn(cached)
            }
            let account = try await client.account()
            guard generation == current, !Task.isCancelled else { return }
            if scopedClient == nil { try await openStore(accountID: account.userId) }
            await client.localStore?.save(account, for: "account")
            state = .signedIn(account)
            membership.start(session: self)
        } catch {
            guard generation == current, !Task.isCancelled else { return }
            let cause = MobileClient.cause(of: error)
            if Self.requiresSignIn(cause) || (cause as? MobileFailure)?.error.code == "unauthenticated" {
                await clearStore(); state = .signedOut
            } else if !state.isSignedIn && !MobileClient.isConnectionFailure(error) { state = .unavailable("暂时无法连接文库，请稍后重试。") }
        }
    }
    func signIn(email: String, password: String) async throws {
        let current = generation
        var stage = SignInFailure.Stage.authentication
        do {
            try await tokens.signIn(email: email, password: password)
            stage = .account
            let account = try await onlineClient.account()
            guard generation == current, !Task.isCancelled else { throw CancellationError() }
            stage = .storage
            try await openStore(accountID: account.userId)
            await client.localStore?.save(account, for: "account")
            state = .signedIn(account)
            membership.start(session: self)
        } catch {
            guard generation == current, !Task.isCancelled, !(error is CancellationError) else { throw CancellationError() }
            let failure = SignInFailure(stage: stage, underlying: error)
            failure.log()
            throw failure
        }
    }
    func signUp(email: String, password: String) async throws -> Bool {
        let current = generation
        let requiresConfirmation = try await tokens.signUp(email: email, password: password)
        guard current == generation, !Task.isCancelled else { throw CancellationError() }
        if !requiresConfirmation { await restore() }
        return requiresConfirmation
    }
    func resendConfirmation(email: String) async throws { try await tokens.resendConfirmation(email: email) }
    func completeAccountEntry(_ context: AccountEntryContext?) async throws {
        guard state.isSignedIn else { return }
        if let context, let word = context.word {
            _ = try await client.createVocabulary(requestID: context.id.uuidString, language: word.language,
                fields: VocabularyFields(original: word.original, definition: word.definition))
            await SavedWordsWidgetSync.refresh(client: client)
        }
        entry = nil
    }
    func requestDeletion() async {
        guard let id = state.accountID else { return }
        await deletion.submit(client: client, userID: id)
        await finishAcceptedDeletion()
    }
    func finishAcceptedDeletion() async {
        guard deletion.accepted, !deletion.localCleaned, let id = deletion.userID else { return }
        let cachedID = await tokens.cachedUserID()
        let notes = state.accountID == id ? client.notesStore : nil
        if state.accountID == nil || state.accountID == id { entry = nil; passwordRecovery = false }
        if state.accountID == id || cachedID == id { await signOut() }
        do {
            if let notes { try await notes.purge() }
            else {
                let store = try PDFNotesStore(root: PDFNotesStore.applicationRoot(), origin: configuration.apiURL, accountID: id)
                try await store.purge()
            }
            let reading = try LocalReadingStore(root: LocalReadingStore.applicationRoot(), origin: configuration.apiURL, accountID: id)
            try await reading.purge()
            try HomeWallpaperStore(namespace: id).removeAll()
            for key in UserDefaults.standard.dictionaryRepresentation().keys where key.hasSuffix(".\(id)") {
                UserDefaults.standard.removeObject(forKey: key)
            }
            try deletion.markLocalCleaned()
        } catch { deletion.localCleanupFailed = true }
    }
    func sendPasswordRecovery(email: String) async throws { try await tokens.sendPasswordRecovery(email: email) }
    func completePasswordRecovery(_ password: String) async throws {
        let current = generation
        try await tokens.updatePassword(password)
        guard current == generation, !Task.isCancelled else { throw CancellationError() }
        passwordRecovery = false
        await restore()
    }
    @discardableResult
    func handleAuthCallback(_ url: URL) async throws -> Bool {
        guard Self.isAuthCallback(url) else { return false }
        let current = generation
        let previousAccountID = await tokens.cachedUserID()
        try await tokens.handleCallback(url)
        guard current == generation, !Task.isCancelled else { throw CancellationError() }
        let callbackAccountID = await tokens.cachedUserID()
        if callbackAccountID != previousAccountID { deletion.presented = false }
        passwordRecovery = Self.isPasswordRecoveryCallback(url)
        await restore()
        guard await tokens.cachedUserID() == callbackAccountID, !Task.isCancelled else { throw CancellationError() }
        if entry == nil { entry = AccountEntryContext(purpose: .account) }
        authCallbackRevision += 1
        return true
    }
    nonisolated static func isAuthCallback(_ url: URL) -> Bool {
        url.scheme?.lowercased() == "leximory" && url.host?.lowercased() == "auth" && url.path == "/callback"
            && url.user == nil && url.password == nil && url.port == nil
    }
    nonisolated static func isPasswordRecoveryCallback(_ url: URL) -> Bool {
        guard isAuthCallback(url) else { return false }
        let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        let fragment = URLComponents(string: "?" + (url.fragment ?? ""))?.queryItems ?? []
        return query.contains { $0.name == "flow" && $0.value == "recovery" }
            || (query + fragment).contains { $0.name == "type" && $0.value == "recovery" }
    }

    func refreshAccount() async {
        let current = generation
        guard state.isSignedIn else { return }
        do {
            let account = try await client.account()
            guard generation == current, state.isSignedIn, !Task.isCancelled else { return }
            state = .signedIn(account)
            membership.start(session: self)
        } catch { }
    }
    func updateAvatar(_ data: Data) async throws {
        let current = generation
        let url = try await client.uploadAccountAvatar(data)
        guard generation == current, !Task.isCancelled else { throw CancellationError() }
        try await tokens.updateAvatar(url)
        guard generation == current, !Task.isCancelled else { throw CancellationError() }
        if var settings = await client.localStore?.value(AccountSettings.self, for: "account-settings"),
           settings.userId == state.accountID {
            settings.image = url.absoluteString
            await client.localStore?.save(settings, for: "account-settings")
        }
        guard generation == current, !Task.isCancelled else { throw CancellationError() }
        avatarRevision += 1
    }
    private func openStore(accountID: String) async throws {
        await clearStore(clearWidget: false)
        let store = try LocalReadingStore(root: LocalReadingStore.applicationRoot(), origin: configuration.apiURL, accountID: accountID.lowercased())
        let notes = try PDFNotesStore(root: PDFNotesStore.applicationRoot(), origin: configuration.apiURL, accountID: accountID)
        let scoped = makeClient(store: store, notesStore: notes, accountID: accountID)
        scopedClient = scoped
        scopedAccountID = accountID.lowercased()
        sync = NativeSync(store: store, client: scoped)
        SavedWordsWidgetSync.activate(origin: configuration.apiURL, accountID: accountID)
    }
    private func clearStore(clearWidget: Bool = true, preservingReading: Bool = false) async {
        if clearWidget { SavedWordsWidgetSync.clear() }
        let previous = sync
        sync = nil; scopedClient = nil; scopedAccountID = nil
        await previous?.stop(preservingReading: preservingReading)
    }
    nonisolated static func requiresSignIn(_ error: any Error) -> Bool {
        guard let authError = error as? AuthError else { return false }
        return [ErrorCode.sessionNotFound, .sessionExpired, .refreshTokenNotFound, .refreshTokenAlreadyUsed, .badJWT, .invalidJWT, .userBanned].contains(authError.errorCode)
    }
    private func expire(generation current: Int) async {
        guard generation == current, state.isSignedIn else { return }
        if let id = state.accountID { UserDefaults.standard.removeObject(forKey: "recent-access.\(id)") }
        membership.stop()
        generation += 1
        let expiredGeneration = generation
        state = .restoring
        await clearStore()
        await tokens.signOut()
        guard generation == expiredGeneration else { return }
        state = .expired
        if !deletion.accepted { entry = AccountEntryContext() }
    }
    private func expire(rejected: String) async {
        let current = generation
        guard await tokens.matches(rejected), generation == current else { return }
        await expire(generation: current)
    }
    func signOut() async {
        passwordRecovery = false
        entry = nil
        if let id = state.accountID { UserDefaults.standard.removeObject(forKey: "recent-access.\(id)") }
        membership.stop()
        generation += 1
        state = .restoring
        await clearStore()
        await tokens.signOut()
        state = .signedOut
    }
}
