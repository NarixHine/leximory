import Foundation
import SwiftUI
import Network
import LeximoryCore

@MainActor @Observable final class NativeSync {
    private(set) var online = true
    private(set) var syncing = false
    private(set) var savedBooks = 0
    private(set) var bytes = 0
    private(set) var lastSync: Date?
    private(set) var incomplete = false
    private(set) var storageFailure = false
    private(set) var revision = 0
    private(set) var downloadedTextIDs: Set<String> = []
    @ObservationIgnored private let monitor = NWPathMonitor()
    @ObservationIgnored private var pathAvailable = true
    @ObservationIgnored private var syncTask: Task<Void, Never>?
    @ObservationIgnored private var observer: Task<Void, Never>?
    @ObservationIgnored private var stopped = false
    @ObservationIgnored private var active = false
    @ObservationIgnored private var runID: UUID?
    let store: LocalReadingStore
    let client: MobileClient
    init(store: LocalReadingStore, client: MobileClient) {
        self.store = store; self.client = client
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--offline") {
            pathAvailable = false; online = false
            Task { await store.setOnline(false) }
        }
        #endif
        monitor.pathUpdateHandler = { [weak self] path in
            let available = path.status == .satisfied
            Task { @MainActor [weak self] in
                guard let self, !stopped else { return }
                #if DEBUG
                if ProcessInfo.processInfo.arguments.contains("--offline") { return }
                #endif
                pathAvailable = available
                await store.setOnline(available)
                if available && active { await refresh() }
            }
        }
        monitor.start(queue: DispatchQueue(label: "com.leximory.sync.path"))
        observer = Task { [weak self, store] in
            for await status in await store.updates() {
                guard let self, !Task.isCancelled else { return }
                online = status.online; savedBooks = status.savedBooks; bytes = status.bytes
                lastSync = status.lastSync; storageFailure = status.storageFailure; downloadedTextIDs = status.downloadedTextIDs
            }
        }
    }
    func run() async {
        let id = UUID(); runID = id; active = true
        defer { if runID == id { active = false; runID = nil } }
        while !Task.isCancelled && !stopped {
            await refresh()
            do { try await Task.sleep(for: .seconds(online ? 300 : 20)) } catch { return }
        }
    }
    func refresh() async {
        guard !stopped, pathAvailable else { return }
        if let syncTask { await syncTask.value; return }
        syncing = true; incomplete = false
        let task = Task { [client, store] in
            // A successful path alone cannot prove that the backend is reachable.
            // Retry reads on foreground/reconnect; failed requests restore read-only mode.
            await store.setOnline(true)
            do {
                _ = try await client.account()
                let libraries = try await client.allLibraries()
                var complete = true
                for library in libraries {
                    try Task.checkCancellation()
                    do {
                        let texts = try await client.allTexts(libraryID: library.id)
                        _ = try await client.allVocabulary(libraryID: library.id)
                        // Limit downloads and document decoding to three concurrent texts.
                        for offset in stride(from: 0, to: texts.count, by: 3) {
                            let batch = Array(texts[offset..<min(offset + 3, texts.count)])
                            await withTaskGroup(of: Bool.self) { group in
                                for text in batch {
                                    group.addTask {
                                        do {
                                            try Task.checkCancellation()
                                            let details = try await client.documentDetails(textID: text.id)
                                            if text.format == "ebook" { _ = try await client.downloadEbook(textID: text.id) }
                                            if let document = details.document {
                                                for block in document.blocks {
                                                    for span in block.spans {
                                                        if case .image(let url, _) = span.style {
                                                            if await store.data(for: "image/\(url.absoluteString)") == nil {
                                                                let data = try await LocalAssetDownloads.shared.load(url, limit: 8 * 1024 * 1024)
                                                                try await store.saveData(data, for: "image/\(url.absoluteString)")
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            return true
                                        } catch { return false }
                                    }
                                }
                                for await success in group { if !success { complete = false } }
                            }
                        }
                    } catch {
                        if Task.isCancelled { return }
                        complete = false
                    }
                }
                try Task.checkCancellation()
                if complete { await store.completeSync() }
                incomplete = !complete
                revision += 1
            } catch {
                if !Task.isCancelled { incomplete = true }
            }
        }
        syncTask = task
        await task.value
        syncTask = nil; syncing = false
    }
    func pause() { active = false; runID = nil; syncTask?.cancel() }
    func stop() async {
        stopped = true; monitor.cancel(); observer?.cancel(); syncTask?.cancel()
        await store.close()
    }
}

extension EnvironmentValues {
    @Entry var nativeSync: NativeSync? = nil
}

struct OfflineReadingNotice: View {
    @Environment(\.nativeSync) private var sync
    var body: some View {
        if sync?.online == false {
            Label("离线阅读 · 只读", systemImage: "wifi.slash")
                .font(LeximoryTypography.interface(12)).foregroundStyle(LeximoryPalette.muted)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(LeximoryPalette.shell, in: Capsule())
                .accessibilityIdentifier("offline-reading-notice")
        }
    }
}
