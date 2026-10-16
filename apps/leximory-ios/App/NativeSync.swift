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
    @ObservationIgnored private var catalogTask: Task<Bool, Never>?
    @ObservationIgnored private var observer: Task<Void, Never>?
    @ObservationIgnored private var notesTask: Task<Void, Never>?
    @ObservationIgnored private var scheduledNotes: Task<Void, Never>?
    @ObservationIgnored private var stopped = false
    @ObservationIgnored private var active = false
    @ObservationIgnored private var runID: UUID?
    let store: LocalReadingStore
    let client: MobileClient
    let notes: PDFNotesSync?
    var activePDF: PDFNoteDocument?
    init(store: LocalReadingStore, client: MobileClient) {
        self.store = store; self.client = client
        notes = client.notesStore.map { PDFNotesSync(store: $0, remote: client) }
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
        notesTask?.cancel()
        notesTask = Task { [weak self] in
            while let self, !Task.isCancelled, !self.stopped {
                await self.syncNotes()
                do { try await Task.sleep(for: .seconds(20)) } catch { return }
            }
        }
        defer { if runID == id { active = false; runID = nil; notesTask?.cancel() } }
        while !Task.isCancelled && !stopped {
            await refresh()
            do { try await Task.sleep(for: .seconds(online ? 300 : 20)) } catch { return }
        }
    }
    func refresh() async {
        guard !stopped, pathAvailable else { return }
        scheduleNotes()
        if let syncTask { await syncTask.value; return }
        syncing = true; incomplete = false
        let task = Task { [client, store] in
            // A successful path alone cannot prove that the backend is reachable.
            // Retry reads on foreground/reconnect; failed requests restore read-only mode.
            await store.setOnline(true)
            do {
                _ = try await client.account()
                let libraries = try await client.allLibraries()
                try await client.notesStore?.reconcileSources(libraryIDs: Set(libraries.map(\.id)))
                var complete = true
                for library in libraries {
                    try Task.checkCancellation()
                    do {
                        let texts = try await client.allTexts(libraryID: library.id)
                        try await client.notesStore?.reconcileSources(libraryID: library.id, textIDs: Set(texts.map(\.id)))
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
    func refreshBookmarks(prioritizing expanded: Set<String>) async -> Bool {
        guard !stopped, pathAvailable else { return false }
        if let catalogTask { return await catalogTask.value }
        let task = Task { [self] in
            for attempt in 0..<MutationRetry.maxAttempts {
                guard !Task.isCancelled, !stopped, pathAvailable else { return false }
                // Probe again after a connection failure instead of trusting the stale offline flag.
                await store.setOnline(true)
                do {
                    let libraries = try await client.allLibraries()
                    try Task.checkCancellation()
                    revision += 1
                    let folders = libraries.filter { !$0.archived }.sorted {
                        expanded.contains($0.id) && !expanded.contains($1.id)
                    }
                    var failure: (any Error)?
                    for folder in folders {
                        try Task.checkCancellation()
                        do {
                            _ = try await client.allTexts(libraryID: folder.id)
                            try Task.checkCancellation()
                            revision += 1
                        } catch {
                            if failure == nil { failure = error }
                        }
                    }
                    if let failure { throw failure }
                    return true
                } catch {
                    guard !Task.isCancelled, MutationRetry.isRetryable(error), attempt + 1 < MutationRetry.maxAttempts else { return false }
                    do { try await MutationRetry.pause(after: attempt) } catch { return false }
                }
            }
            return false
        }
        catalogTask = task
        let complete = await task.value
        catalogTask = nil
        return complete
    }
    func scheduleNotes() {
        scheduledNotes?.cancel()
        scheduledNotes = Task { [weak self] in
            do { try await Task.sleep(for: .milliseconds(600)) } catch { return }
            await self?.syncNotes()
        }
    }
    private func syncNotes() async {
        guard active, pathAvailable, !stopped else { return }
        do { try await notes?.synchronize(document: activePDF) } catch { }
    }
    func pause() { active = false; runID = nil; syncTask?.cancel(); catalogTask?.cancel(); notesTask?.cancel(); scheduledNotes?.cancel() }
    func stop() async {
        stopped = true; monitor.cancel(); observer?.cancel(); syncTask?.cancel(); catalogTask?.cancel()
        notesTask?.cancel(); scheduledNotes?.cancel()
        await notes?.stop()
        await client.notesStore?.close()
        await store.close()
    }
}

extension EnvironmentValues {
    @Entry var nativeSync: NativeSync? = nil
}
