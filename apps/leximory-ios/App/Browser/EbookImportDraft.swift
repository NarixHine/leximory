import SwiftUI

@MainActor @Observable final class EbookImportDraft {
    var title: String
    var folderID: String?
    private(set) var titleRevision = 0
    private(set) var titleEdited = false
    private(set) var folderEdited = false
    @ObservationIgnored private var titleTask: Task<Void, Never>?
    @ObservationIgnored private var folderTask: Task<Void, Never>?
    @ObservationIgnored private var stopped = false

    init(filename: String, folderID: String? = nil) {
        title = EbookImportMetadata.fallback(filename: filename)
        self.folderID = folderID
    }
    func takeTitle() { titleEdited = true; titleTask?.cancel() }
    func takeFolder() { folderEdited = true; folderTask?.cancel() }
    func stop() { stopped = true; titleTask?.cancel(); folderTask?.cancel() }

    func fill(metadata: EbookImportMetadata, reduceMotion: Bool,
              suggest: @escaping @MainActor (String) async throws -> String?) async {
        guard !stopped, !Task.isCancelled else { return }
        let animation: Animation? = reduceMotion ? nil : .easeOut(duration: 0.18)
        if !titleEdited, !metadata.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            withAnimation(animation) { title = metadata.title; titleRevision += 1 }
        }
        let titleTask = Task { [weak self] in
            guard let self, !titleEdited else { return }
            guard let value = try? await suggest("title"), !Task.isCancelled, !titleEdited, !stopped,
                  !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, value != title else { return }
            withAnimation(animation) { title = value; titleRevision += 1 }
        }
        let folderTask = Task { [weak self] in
            guard let self, !folderEdited else { return }
            guard let value = try? await suggest("folder"), !Task.isCancelled, !folderEdited, !stopped else { return }
            withAnimation(animation) { folderID = value }
        }
        self.titleTask = titleTask; self.folderTask = folderTask
        await withTaskCancellationHandler {
            await titleTask.value; await folderTask.value
        } onCancel: {
            titleTask.cancel(); folderTask.cancel()
        }
    }
}
