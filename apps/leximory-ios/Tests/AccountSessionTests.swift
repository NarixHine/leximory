import Foundation
import Auth
import Testing

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
