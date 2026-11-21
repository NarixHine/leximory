import SwiftUI
import LeximoryCore

struct ArticleAudioButton: View {
    let textID: TextID
    let title: String
    let document: ReadingDocument
    let fullAudioID: String?
    let canGenerate: Bool
    let online: Bool
    let client: MobileClient?
    let playback: PlaybackController
    var onGenerated: (String) -> Void = { _ in }
    @State private var requestID: UUID?
    @State private var generating = false
    @State private var failure: String?

    var presentationID: String { "\(document.revision):\(fullAudioID ?? ""):\(canGenerate):\(online)" }
    var body: some View {
        if fullAudioID != nil || canGenerate && client != nil {
            VStack(alignment: .leading, spacing: 8) {
                Button {
                    if let fullAudioID {
                        playback.play(textID: textID, audioID: fullAudioID, title: title)
                    } else {
                        failure = nil; generating = true; requestID = UUID()
                    }
                } label: {
                    HStack(spacing: 8) {
                        if generating {
                            ProgressView().controlSize(.small).accessibilityHidden(true)
                        } else {
                            Image(systemName: fullAudioID == nil ? "waveform.badge.plus" : "play.fill")
                                .accessibilityHidden(true)
                        }
                        Text(fullAudioID != nil ? "朗读全文" : generating ? "正在生成全文录音" : "生成全文录音")
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .interfaceFont(15, style: .subheadline)
                    .foregroundStyle(.primary)
                    .frame(minHeight: 44)
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .disabled(generating || !online)
                .accessibilityIdentifier(fullAudioID == nil ? "generate-article-audio" : "play-article-audio")
                if let failure {
                    Text(failure).interfaceFont(14).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .task(id: requestID) {
                guard requestID != nil, let client else { return }
                defer { generating = false }
                do {
                    let id = try await client.generateArticleAudio(textID: textID.rawValue, revision: document.revision)
                    try Task.checkCancellation()
                    onGenerated(id)
                    playback.play(textID: textID, audioID: id, title: title)
                } catch {
                    guard !Task.isCancelled else { return }
                    if let error = MobileClient.cause(of: error) as? MobileFailure {
                        failure = error.error.code == "quota_exceeded" ? "本期 AI 朗读额度不足。" : error.error.message
                    } else { failure = "全文录音暂未生成，请重试。" }
                }
            }
            .onChange(of: document.revision) { _, _ in
                requestID = nil; generating = false; failure = nil
            }
        }
    }
}
