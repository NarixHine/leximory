import Foundation
import Auth
import Testing
import Synchronization
import OpenAPIRuntime
import HTTPTypes
import LeximoryCore
@testable import Leximory

struct AccountSessionTests {
    @Test func sessionStorageSurvivesReopening() throws {
        let key = "leximory.auth-verification.\(UUID().uuidString)"
        let storage = KeychainLocalStorage(service: "com.leximory.reader.auth")
        let value = Data("local-session-storage-check".utf8)
        defer { try? storage.remove(key: key) }

        try storage.store(key: key, value: value)
        let reopened = KeychainLocalStorage(service: "com.leximory.reader.auth")
        #expect(try reopened.retrieve(key: key) == value)
        try reopened.remove(key: key)
    }
}

@MainActor struct AccountIdentityTests {
    private let first = "11111111-1111-4111-8111-111111111111"
    private let second = "22222222-2222-4222-8222-222222222222"
    private var configuration: AppConfiguration {
        AppConfiguration(apiURL: URL(string: "https://identity-\(UUID().uuidString).invalid")!,
            supabaseURL: URL(string: "https://auth.invalid")!, anonKey: "fixture")
    }
    @Test func wrongAccountReauthenticationDoesNotReplaceTheCurrentCredential() async throws {
        let fixture = IdentityAuth(first: first, second: second)
        let tokens = AccountTokens(configuration: configuration, storage: IdentityStorage(), fetch: fixture.fetch)
        try await tokens.signIn(email: "first@example.com", password: "password")
        await #expect(throws: URLError.self) {
            try await tokens.reauthenticate(email: "second@example.com", password: "password", expectedUserID: first)
        }
        #expect(await tokens.cachedUserID() == first)
        try await tokens.reauthenticate(email: "first@example.com", password: "password", expectedUserID: first)
        #expect(await tokens.cachedUserID() == first)
        await tokens.signOut()
    }
    @Test func callbackSwitchesAccountPartitionsAndRejectsThePreviousAccountClient() async throws {
        let fixture = IdentityAuth(first: first, second: second)
        let config = configuration
        let tokens = AccountTokens(configuration: config, storage: IdentityStorage(), fetch: fixture.fetch)
        let session = AccountSession(configuration: config, tokens: tokens, transport: IdentityTransport())
        try await session.signIn(email: "first@example.com", password: "password")
        let oldClient = session.client
        await oldClient.localStore?.save("private-first-account", for: "identity-proof")
        try await tokens.sendPasswordRecovery(email: "second@example.com")
        try await session.handleAuthCallback(URL(string: "leximory://auth/callback?flow=recovery&code=second")!)
        #expect(session.state.accountID == second)
        #expect(session.passwordRecovery)
        #expect(await session.client.localStore?.value(String.self, for: "identity-proof") == nil)
        await #expect(throws: CancellationError.self) { _ = try await tokens.token(rejected: nil, expectedUserID: first) }
        await #expect(throws: (any Error).self) { _ = try await oldClient.account() }
        await session.signOut()
        let oldStore = try LocalReadingStore(root: LocalReadingStore.applicationRoot(), origin: config.apiURL, accountID: first)
        try await oldStore.purge()
    }

    private final class IdentityStorage: AuthLocalStorage {
        let values = Mutex([String: Data]())
        func store(key: String, value: Data) throws { values.withLock { $0[key] = value } }
        func retrieve(key: String) throws -> Data? { values.withLock { $0[key] } }
        func remove(key: String) throws { values.withLock { _ = $0.removeValue(forKey: key) } }
    }
    private struct IdentityAuth: Sendable {
        let first: String
        let second: String
        func fetch(_ request: URLRequest) async throws -> (Data, URLResponse) {
            let url = try #require(request.url)
            let isSecond = request.httpBody.map { String(decoding: $0, as: UTF8.self).contains("second") } == true
                || request.value(forHTTPHeaderField: "Authorization")?.contains(Self.token(second)) == true
            let id = isSecond ? second : first
            let user = User(id: UUID(uuidString: id)!, appMetadata: [:], userMetadata: [:], aud: "authenticated", email: isSecond ? "second@example.com" : "first@example.com", createdAt: .now, updatedAt: .now)
            let data: Data
            if url.path.hasSuffix("/recover") { data = Data("{}".utf8) }
            else if url.path.hasSuffix("/user") { data = try AuthClient.Configuration.jsonEncoder.encode(user) }
            else {
                let session = Session(accessToken: Self.token(id), tokenType: "bearer", expiresIn: 3600,
                    expiresAt: Date().addingTimeInterval(3600).timeIntervalSince1970, refreshToken: "refresh-\(id)", user: user)
                data = try AuthClient.Configuration.jsonEncoder.encode(session)
            }
            return (data, HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!)
        }
        static func token(_ id: String) -> String {
            let payload = Data("{\"sub\":\"\(id)\",\"exp\":4102444800}".utf8).base64EncodedString()
                .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
            return "eyJhbGciOiJIUzI1NiJ9.\(payload).signature"
        }
    }
    private struct IdentityTransport: ClientTransport {
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            guard operationID == "me" else { throw URLError(.unsupportedURL) }
            let token = try #require(request.headerFields[.authorization]?.split(separator: ".").dropFirst().first)
            var encoded = String(token).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
            while encoded.count % 4 != 0 { encoded += "=" }
            struct Claims: Decodable { let sub: String }
            let id = try JSONDecoder().decode(Claims.self, from: #require(Data(base64Encoded: encoded))).sub
            return (.init(status: .ok), HTTPBody("{\"userId\":\"\(id)\",\"plan\":\"beginner\",\"definitions\":{\"used\":0,\"limit\":40,\"resetsIn\":100}}"))
        }
    }
}

struct SignInFailureTests {
    @Test func accountLoadingFailureDoesNotBlameCredentials() {
        let failure = SignInFailure(stage: .account, underlying: URLError(.badServerResponse))
        #expect(failure.errorDescription == "暂时无法登录，请稍后重试。")
    }

    @Test func storageFailureDoesNotBlameCredentials() {
        let failure = SignInFailure(stage: .storage, underlying: CocoaError(.fileWriteNoPermission))
        #expect(failure.errorDescription == "暂时无法登录，请稍后重试。")
    }

    @Test func networkFailureOffersNetworkRecovery() {
        let failure = SignInFailure(stage: .authentication, underlying: URLError(.notConnectedToInternet))
        #expect(failure.errorDescription == "暂时无法连接，请检查网络后重试。")
    }

    @Test func unconfirmedEmailExplainsRequiredAction() throws {
        let response = try #require(HTTPURLResponse(url: URL(string: "https://auth.test")!, statusCode: 400, httpVersion: nil, headerFields: nil))
        let error = AuthError.api(message: "Email not confirmed", errorCode: .emailNotConfirmed, underlyingData: Data(), underlyingResponse: response)
        #expect(SignInFailure(stage: .authentication, underlying: error).errorDescription == "请先通过确认邮件验证邮箱，再登录。")
    }

    @Test func rejectedCredentialsOfferPasswordRecovery() throws {
        let response = try #require(HTTPURLResponse(url: URL(string: "https://auth.test")!, statusCode: 400, httpVersion: nil, headerFields: nil))
        let error = AuthError.api(message: "Invalid login credentials", errorCode: .invalidCredentials, underlyingData: Data(), underlyingResponse: response)
        #expect(SignInFailure(stage: .authentication, underlying: error).errorDescription == "邮箱或密码不正确，请重试或重设密码。")
    }
}
