import Foundation

@MainActor final class EbookPositionSaver {
    private let save: (String) async throws -> Void
    private var pendingLocation: String?
    private var task: Task<Void, Never>?

    init(save: @escaping (String) async throws -> Void) { self.save = save }

    func schedule(_ location: String) {
        pendingLocation = location
        task?.cancel()
        task = Task {
            do { try await Task.sleep(for: .milliseconds(750)) }
            catch { return }
            await persist(location)
        }
    }

    func flush() {
        task?.cancel()
        guard let location = pendingLocation else { return }
        task = Task { await persist(location) }
    }

    private func persist(_ location: String) async {
        do {
            try await save(location)
            if pendingLocation == location { pendingLocation = nil }
        } catch { /* Reading-position sync never interrupts reading. */ }
    }
}
