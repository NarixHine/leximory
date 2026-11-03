import SwiftUI

@MainActor @Observable final class EbookImportDraft {
    enum Autofill: Equatable { case filling, filled }
    var title: String
    var folderID: String?
    private(set) var titleAutofill: Autofill? = .filling
    private(set) var folderAutofill: Autofill? = .filling
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
    func takeTitle() { titleEdited = true; titleAutofill = nil; titleTask?.cancel() }
    func takeFolder() { folderEdited = true; folderAutofill = nil; folderTask?.cancel() }
    func stop() {
        stopped = true; titleAutofill = nil; folderAutofill = nil
        titleTask?.cancel(); folderTask?.cancel()
    }

    func fill(metadata: EbookImportMetadata, reduceMotion: Bool,
              suggest: @escaping @MainActor (String) async throws -> String?) async {
        guard !stopped, !Task.isCancelled else { return }
        let animation: Animation? = reduceMotion ? nil : .easeOut(duration: 0.18)
        if !titleEdited, !metadata.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            withAnimation(animation) { title = metadata.title; titleRevision += 1 }
        }
        let titleTask = Task { [weak self] in
            guard let self, !titleEdited else { return }
            defer {
                if !titleEdited, !stopped {
                    titleAutofill = title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : .filled
                }
            }
            guard let value = try? await suggest("title"), !Task.isCancelled, !titleEdited, !stopped,
                  !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, value != title else { return }
            withAnimation(animation) { title = value; titleRevision += 1 }
        }
        let folderTask = Task { [weak self] in
            guard let self, !folderEdited else { return }
            defer {
                if !folderEdited, !stopped { folderAutofill = folderID == nil ? nil : .filled }
            }
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

struct EbookAutofillCue: View {
    let state: EbookImportDraft.Autofill?
    @ScaledMetric(relativeTo: .footnote) private var indicatorSize = 14
    @ScaledMetric(relativeTo: .footnote) private var symbolSize = 11

    var body: some View {
        if let state {
            Group {
                if state == .filling {
                    ProgressView().controlSize(.mini).tint(.secondary)
                } else {
                    Image(systemName: "sparkles").font(.system(size: symbolSize))
                        .foregroundStyle(.secondary)
                }
            }
                .frame(width: indicatorSize, height: indicatorSize)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(state == .filling ? "正在自动填写，可随时修改" : "已自动填写，可随时修改")
                .allowsHitTesting(false)
        }
    }
}
