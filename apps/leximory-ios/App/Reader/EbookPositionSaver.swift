import Foundation

@MainActor final class EbookPositionSaver {
    private let save: (String) async throws -> Void
    private var suspended = false
    private var pendingLocation: String?
    private var task: Task<Void, Never>?
    private var writes: Task<Void, Never>?

    init(save: @escaping (String) async throws -> Void) { self.save = save }

    func schedule(_ location: String) {
        guard !suspended else { return }
        pendingLocation = location
        task?.cancel()
        task = Task {
            do { try await Task.sleep(for: .milliseconds(750)) }
            catch { return }
            await persist(location)
        }
    }

    func flush() {
        guard !suspended else { return }
        task?.cancel()
        guard let location = pendingLocation else { return }
        task = Task { await persist(location) }
    }

    func suspend() async {
        suspended = true; pendingLocation = nil
        task?.cancel(); await task?.value
        await writes?.value
        task = nil; writes = nil
    }
    func resume() { suspended = false }
    private func persist(_ location: String) async {
        guard !suspended else { return }
        let previous = writes
        // Keep an active request alive when a newer debounce is cancelled. File
        // replacement waits for this chain before resetting the book's position.
        let write = Task {
            await previous?.value
            do {
                try await save(location)
                if pendingLocation == location { pendingLocation = nil }
            } catch { /* Reading-position sync never interrupts reading. */ }
        }
        writes = write
        await write.value
    }
}
