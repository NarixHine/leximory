import SwiftUI
import LeximoryCore

enum ReviewExercise: Hashable {
    case translation(Int), conversation
}

@MainActor @Observable final class ReviewModel {
    let client: MobileClient
    let selection: ReviewSelection
    private(set) var snapshot: ReviewSnapshot?
    private(set) var error: String?
    private(set) var submitting = false
    var awaitingConfirmation: Bool { pendingSubmission != nil }
    private var pendingSubmission: (index: Int?, text: String, sentAt: Date)?
    var drafts: [String: String] = [:]
    var exercise: ReviewExercise?
    private var started = false
    init(client: MobileClient, selection: ReviewSelection) { self.client = client; self.selection = selection }

    func observe() async {
        if snapshot == nil { snapshot = await client.localStore?.value(ReviewSnapshot.self, for: "review/" + selection.id) }
        while !Task.isCancelled {
            do {
                let value = try await client.reviewSnapshot(selection)
                try Task.checkCancellation()
                accept(value)
                await client.localStore?.save(value, for: "review/" + selection.id)
                if !value.exists && !value.inProgress && !started {
                    try await client.startReview(selection)
                    started = true
                }
                if snapshot != nil { error = nil }
            } catch {
                if Task.isCancelled { return }
                if snapshot?.exists != true && snapshot?.inProgress != true { self.error = "复习暂时无法打开，请稍后重试。" }
            }
            let idle = snapshot?.exists == true && snapshot?.needsRefresh == false && !awaitingConfirmation
            for _ in 0..<(idle ? 15 : 1) {
                do { try await Task.sleep(for: .seconds(2)) } catch { return }
                if snapshot?.needsRefresh == true || awaitingConfirmation { break }
            }
        }
    }

    private func accept(_ value: ReviewSnapshot) {
        snapshot = value
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
            if Task.isCancelled { return }
            if let failure = error as? ReviewHTTPError, (400..<500).contains(failure.status) {
                pendingSubmission = nil
            }
            // A response may be lost after the server accepted the answer. Read before permitting a repeat.
            if let current = try? await client.reviewSnapshot(selection) { accept(current) }
            self.error = "暂时无法确认提交结果。你的文字已保留，请稍后查看。"
        }
    }
}
