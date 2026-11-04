import SwiftUI
import LeximoryCore

enum ReviewExercise: Hashable {
    case translation(Int), conversation
}

enum ReviewLoadState: Equatable {
    case loading, preparing, ready, empty
    case unavailable(String)
}

@MainActor @Observable final class ReviewModel {
    let client: MobileClient
    let selection: ReviewSelection
    private(set) var snapshot: ReviewSnapshot?
    private(set) var loadState: ReviewLoadState = .loading
    private(set) var loadAttempt = 0
    private(set) var error: String?
    private(set) var submitting = false
    var awaitingConfirmation: Bool { pendingSubmission != nil }
    private var pendingSubmission: (index: Int?, text: String, sentAt: Date)?
    var drafts: [String: String] = [:]
    var exercise: ReviewExercise?
    init(client: MobileClient, selection: ReviewSelection) { self.client = client; self.selection = selection }

    func retryLoading() {
        loadState = .loading
        loadAttempt += 1
    }

    private var hasExercises: Bool {
        snapshot?.translations?.isEmpty == false || snapshot?.conversation != nil
    }

    func observe(now: () -> Date = Date.init, pause: @Sendable (Duration) async throws -> Void = { try await Task.sleep(for: $0) }) async {
        if snapshot == nil {
            let cached = await client.localStore?.value(ReviewSnapshot.self, for: "review/" + selection.id)
            guard !Task.isCancelled else { return }
            if let cached { accept(cached) }
        }
        if !hasExercises { loadState = .loading }
        var failures = 0
        let startedAt = now()
        while !Task.isCancelled {
            do {
                let value = try await client.reviewSnapshot(selection)
                try Task.checkCancellation()
                accept(value)
                await client.localStore?.save(value, for: "review/" + selection.id)
                try Task.checkCancellation()
                if !value.exists && !value.inProgress {
                    try await client.startReview(selection)
                    try Task.checkCancellation()
                }
                error = nil
                failures = 0
                if !hasExercises && !value.exists && now().timeIntervalSince(startedAt) >= 120 {
                    loadState = .unavailable("练习还没有准备好，请稍后重试。")
                    return
                }
            } catch {
                if Task.isCancelled { return }
                failures += 1
                if !hasExercises && (failures >= 4 || !MutationRetry.isRetryable(error)) {
                    loadState = .unavailable("暂时无法打开复习，请稍后重试。")
                    return
                }
            }
            let idle = snapshot?.exists == true && snapshot?.needsRefresh == false && !awaitingConfirmation
            for _ in 0..<(idle ? 15 : min(15, 1 << min(max(0, failures - 1), 4))) {
                do { try await pause(.seconds(2)) } catch { return }
                if snapshot?.needsRefresh == true || awaitingConfirmation { break }
            }
        }
    }

    private func accept(_ value: ReviewSnapshot) {
        snapshot = value
        loadState = value.inProgress || !value.exists ? .preparing : hasExercises ? .ready : .empty
        guard let pendingSubmission else { return }
        let saved: String?
        if let index = pendingSubmission.index {
            saved = value.translations.flatMap { items in
                items.indices.contains(index) ? items[index].submission : nil
            }
        } else { saved = value.conversation?.submission }
        if saved == pendingSubmission.text || Date().timeIntervalSince(pendingSubmission.sentAt) > 30 {
            self.pendingSubmission = nil
        }
    }

    func submit(index: Int?, text: String) async {
        guard !submitting && !awaitingConfirmation else { return }
        submitting = true
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        pendingSubmission = (index, text, Date())
        defer { submitting = false }
        do {
            try await client.submitReview(selection, index: index, submission: text)
            let current = try await client.reviewSnapshot(selection)
            accept(current)
            await client.localStore?.save(current, for: "review/" + selection.id)
            error = nil
        } catch {
            if Task.isCancelled || MutationRetry.isRetryable(error) { return }
            if let failure = error as? ReviewHTTPError, (400..<500).contains(failure.status) {
                pendingSubmission = nil
            }
            // A response may be lost after the server accepted the answer. Read before permitting a repeat.
            if let current = try? await client.reviewSnapshot(selection) { accept(current) }
            self.error = "暂时无法确认提交结果。你的文字已保留，请稍后查看。"
        }
    }
}
