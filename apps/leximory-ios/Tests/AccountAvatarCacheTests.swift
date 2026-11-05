import Foundation
import UIKit
import Testing
import LeximoryCore
@testable import Leximory

@MainActor struct AccountAvatarCacheTests {
    private let url = URL(string: "https://avatar.invalid/reader.jpg")!

    private func avatarData() throws -> Data {
        try #require(UIGraphicsImageRenderer(size: CGSize(width: 8, height: 8)).image { context in
            UIColor.red.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 8, height: 8))
        }.pngData())
    }

    @Test func repeatedVisitsReuseTheDecodedAvatarWithoutAnotherRequest() async throws {
        let data = try avatarData()
        var requests = 0
        let cache = AccountAvatarCache(fetch: { url in
            requests += 1
            return (data, HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        })
        await cache.load(url: url, store: nil)
        let original = try #require(cache.image(for: url))
        await cache.load(url: url, store: nil)
        #expect(cache.image(for: url) === original)
        #expect(requests == 1)
    }

    @Test func reopeningRestoresTheAvatarBeforeLoadingAndKeepsAccountsIsolated() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = URL(string: "https://leximory.invalid")!
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "first")
        let data = try avatarData()
        let initial = AccountAvatarCache()
        await initial.save(data, url: url, store: store)

        let reopenedStore = try LocalReadingStore(root: root, origin: origin, accountID: "first")
        let reopened = AccountAvatarCache(fetch: { _ in
            Issue.record("A persisted avatar must not need the network")
            throw URLError(.notConnectedToInternet)
        })
        await reopened.restore(url: url, store: reopenedStore)
        #expect(reopened.image(for: url)?.size == UIImage(data: data)?.size)
        await reopened.load(url: url, store: reopenedStore)
        #expect(reopened.image(for: url) != nil)

        let otherStore = try LocalReadingStore(root: root, origin: origin, accountID: "second")
        let other = AccountAvatarCache()
        await other.restore(url: url, store: otherStore)
        #expect(other.image(for: url) == nil)
    }

    @Test func changedURLDoesNotShowThePreviousAvatarAndFailedLoadsCanRetry() async throws {
        let changedURL = URL(string: "https://avatar.invalid/new.jpg")!
        let data = try avatarData()
        var requests = 0
        let cache = AccountAvatarCache(fetch: { url in
            requests += 1
            return (data, HTTPURLResponse(url: url, statusCode: requests == 1 ? 503 : 200,
                                         httpVersion: nil, headerFields: nil)!)
        })
        await cache.save(data, url: url, store: nil)
        #expect(cache.image(for: changedURL) == nil)
        await cache.load(url: changedURL, store: nil)
        #expect(cache.image(for: changedURL) == nil)
        await cache.load(url: changedURL, store: nil)
        #expect(cache.image(for: changedURL)?.size == UIImage(data: data)?.size)
        #expect(cache.image(for: url) == nil)
        await cache.restore(url: nil, store: nil)
        #expect(cache.image(for: nil) == nil)
    }

    @Test func staleAvatarsStayVisibleDuringFailedRefreshAndUploadsReplaceTheSameURL() async throws {
        let data = try avatarData()
        var date = Date(timeIntervalSince1970: 1_000_000)
        var requests = 0
        let cache = AccountAvatarCache(now: { date }, fetch: { _ in
            requests += 1
            throw URLError(.notConnectedToInternet)
        })
        await cache.save(data, url: url, store: nil)
        let original = try #require(cache.image(for: url))
        date.addTimeInterval(3601)
        await cache.load(url: url, store: nil)
        #expect(requests == 1)
        #expect(cache.image(for: url) === original)
        await cache.save(data, url: url, store: nil)
        #expect(cache.image(for: url) != nil)
        #expect(cache.image(for: url) !== original)
    }

    @Test func aPendingDownloadCannotReplaceANewerUploadAtTheSameURL() async throws {
        let data = try avatarData()
        let (started, signal) = AsyncStream.makeStream(of: Void.self)
        var pending: CheckedContinuation<(Data, URLResponse), Never>?
        let cache = AccountAvatarCache(fetch: { _ in
            await withCheckedContinuation { continuation in
                pending = continuation
                signal.yield(())
            }
        })
        let download = Task { await cache.load(url: url, store: nil) }
        for await _ in started { break }
        await cache.save(data, url: url, store: nil)
        let uploaded = try #require(cache.image(for: url))
        pending?.resume(returning: (data, HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!))
        await download.value
        #expect(cache.image(for: url) === uploaded)
        signal.finish()
    }
}
