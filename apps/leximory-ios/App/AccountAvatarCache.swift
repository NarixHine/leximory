import Foundation
import Observation
import UIKit
import LeximoryCore

@MainActor @Observable final class AccountAvatarCache {
    private struct CachedAvatar: Codable, Sendable {
        let url: URL
        let data: Data
        let savedAt: Date
    }

    private var url: URL?
    private var image: UIImage?
    private var savedAt: Date?
    private var revision = 0
    @ObservationIgnored private let fetch: (URL) async throws -> (Data, URLResponse)
    @ObservationIgnored private let now: () -> Date

    init(now: @escaping () -> Date = Date.init,
         fetch: @escaping (URL) async throws -> (Data, URLResponse) = {
             try await URLSession.shared.data(for: URLRequest(url: $0, cachePolicy: .reloadRevalidatingCacheData))
         }) {
        self.now = now
        self.fetch = fetch
    }

    func image(for url: URL?) -> UIImage? {
        self.url == url ? image : nil
    }

    func restore(url: URL?, store: LocalReadingStore?) async {
        if self.url == url, image != nil { return }
        if self.url != url { revision += 1 }
        let current = revision
        self.url = url
        image = nil
        savedAt = nil
        guard let url,
              let cached = await store?.value(CachedAvatar.self, for: "account-avatar"),
              cached.url == url, revision == current, !Task.isCancelled else { return }
        image = UIImage(data: cached.data)
        savedAt = cached.savedAt
    }

    func load(url: URL?, store: LocalReadingStore?) async {
        await restore(url: url, store: store)
        guard let url, self.url == url, !Task.isCancelled else { return }
        if image != nil, let savedAt, now().timeIntervalSince(savedAt) < 3600 { return }
        let current = revision
        do {
            let (data, response) = try await fetch(url)
            guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode),
                  revision == current, !Task.isCancelled else { return }
            await save(data, url: url, store: store)
        } catch { }
    }

    func save(_ data: Data, url: URL, store: LocalReadingStore?) async {
        guard let image = UIImage(data: data) else { return }
        revision += 1
        self.url = url
        self.image = image
        let savedAt = now()
        self.savedAt = savedAt
        await store?.save(CachedAvatar(url: url, data: data, savedAt: savedAt), for: "account-avatar")
    }
}
