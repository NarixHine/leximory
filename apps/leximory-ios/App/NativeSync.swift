import Foundation
import SwiftUI
import Network
import LeximoryCore

@MainActor @Observable final class NativeSync {
    private(set) var online = true
    private(set) var revision = 0
    private(set) var catalogFailed = false
    @ObservationIgnored private let monitor = NWPathMonitor()
    @ObservationIgnored private var pathAvailable = true
    @ObservationIgnored private var catalogTask: Task<Bool, Never>?
    @ObservationIgnored private var observer: Task<Void, Never>?
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
                if available && active { await loadCatalogIfNeeded(); scheduleNotes() }
            }
        }
        monitor.start(queue: DispatchQueue(label: "com.leximory.sync.path"))
        observer = Task { [weak self, store] in
            for await status in await store.updates() {
                guard let self, !Task.isCancelled else { return }
                online = status.online
            }
        }
    }
    func run(waitForNextPass: @Sendable () async throws -> Void = { try await Task.sleep(for: .seconds(20)) }) async {
        let id = UUID(); runID = id; active = true
        defer { if runID == id { active = false; runID = nil } }
        await loadCatalogIfNeeded()
        var recoveryAttempts = 0
        while !Task.isCancelled && !stopped && runID == id {
            if online { recoveryAttempts = 0 }
            if pathAvailable && !online && recoveryAttempts < MutationRetry.maxAttempts {
                recoveryAttempts += 1
                await store.setOnline(true)
                do {
                    _ = try await client.account()
                    await loadCatalogIfNeeded()
                } catch { await store.setOnline(false) }
            }
            await syncNotes()
            do { try await waitForNextPass() } catch { return }
        }
    }
    func loadCatalogIfNeeded() async {
        guard !stopped, pathAvailable, !Task.isCancelled else { return }
        await store.setOnline(true)
        guard await client.cachedLibraries() == nil else { return }
        for attempt in 0..<MutationRetry.maxAttempts {
            do {
                await store.setOnline(true)
                _ = try await client.allLibraries()
                try Task.checkCancellation()
                catalogFailed = false
                revision += 1
                return
            } catch {
                guard !stopped, !Task.isCancelled else { return }
                guard pathAvailable, MutationRetry.isRetryable(error), attempt + 1 < MutationRetry.maxAttempts else {
                    catalogFailed = true
                    return
                }
                do { try await MutationRetry.pause(after: attempt) } catch { return }
            }
        }
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
                    catalogFailed = false
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
        guard active, pathAvailable, !stopped, !Task.isCancelled else { return }
        do { try await notes?.synchronize(document: activePDF) } catch { }
    }
    func pause() { active = false; runID = nil; catalogTask?.cancel(); scheduledNotes?.cancel() }
    func stop() async {
        stopped = true; monitor.cancel(); observer?.cancel(); catalogTask?.cancel()
        scheduledNotes?.cancel()
        await notes?.stop()
        await client.notesStore?.close()
        await store.close()
    }
}

extension EnvironmentValues {
    @Entry var nativeSync: NativeSync? = nil
}
