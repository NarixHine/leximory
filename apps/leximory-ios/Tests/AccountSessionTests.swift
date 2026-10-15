import Foundation
import Auth
import Testing
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
