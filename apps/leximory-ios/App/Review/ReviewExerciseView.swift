import SwiftUI
import LeximoryCore

struct ReviewExerciseView: View {
    @Bindable var model: ReviewModel
    let index: Int?
    let availableHeight: CGFloat
    let close: () -> Void
    @State private var contentHeight: CGFloat = 160
    @State private var showReference = false
    @State private var editing = false
    @FocusState private var focused: Bool
    @Environment(\.nativeSync) private var sync
    @ScaledMetric(relativeTo: .body) private var editorHeight: CGFloat = 50

    private var key: String { index.map { "translation-\($0)" } ?? "conversation" }
    private var translation: ReviewTranslation? {
        guard let index, let items = model.snapshot?.translations, items.indices.contains(index) else { return nil }
        return items[index]
    }
    private var conversation: ReviewConversation? { index == nil ? model.snapshot?.conversation : nil }
    private var status: ReviewStatus { translation?.status ?? conversation?.status ?? .idle }
    private var savedSubmission: String? { translation?.submission ?? conversation?.submission }
    private var feedback: ReviewFeedback? { translation?.feedback ?? conversation?.feedback }
    private var locked: Bool { index == nil && model.snapshot?.conversationUnlocked != true }
    private var limit: Int { index == nil ? 1200 : 500 }
    private var draft: Binding<String> {
        Binding(get: { model.drafts[key] ?? savedSubmission ?? "" }, set: { model.drafts[key] = $0 })
    }
    private var canSubmit: Bool {
        let text = draft.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines)
        return sync?.online != false && !locked && !model.submitting && !model.awaitingConfirmation && status != .pending && !text.isEmpty && text.utf16.count <= limit
    }
    var body: some View {
        VStack(spacing: 12) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(index == nil ? "每日练笔" : "TRANSLATION")
                            .font(ReviewStyle.mono(12)).foregroundStyle(ReviewStyle.meta)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .overlay(alignment: .trailing) {
                                Button("关闭", systemImage: "xmark") { focused = false; close() }
                                    .labelStyle(.iconOnly).frame(width: 44, height: 44).buttonStyle(.plain)
                                    .accessibilityIdentifier("review-exercise-close")
                            }
                        AnnotationMarkdownText(content: translation?.prompt ?? conversation?.prompt ?? "", size: 16, language: index == nil ? learningLanguageName(model.selection.language) : "Chinese")
                        if let translation {
                            Text("（\(translation.keyword)）").font(LeximoryTypography.prose(16, language: learningLanguageName(model.selection.language))).foregroundStyle(ReviewStyle.word)
                        }
                        if let keywords = conversation?.keywords, !keywords.isEmpty {
                            Text("不妨试试选用 \(keywords.prefix(6).joined(separator: " / "))")
                                .font(LeximoryTypography.interface(15)).foregroundStyle(.secondary)
                        }
                    }
                    if locked {
                        VStack(alignment: .leading, spacing: 12) {
                            Label("完成六成翻译，小黑猫就会轻声回应。", systemImage: "lock")
                            Text("完成翻译 \(model.snapshot?.completedTranslations ?? 0)/\(model.snapshot?.translations?.count ?? 0)")
                                .foregroundStyle(.secondary)
                        }.font(LeximoryTypography.interface(16)).padding(22)
                            .frame(maxWidth: .infinity, alignment: .leading).background(LeximoryPalette.cover, in: .rect(cornerRadius: 24))
                    }
                    if let submission = savedSubmission, !editing {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("你的回答").font(LeximoryTypography.interface(13)).foregroundStyle(.secondary)
                                Spacer()
                                if status == .pending { ProgressView(); Text("正在点评").font(LeximoryTypography.interface(13)).foregroundStyle(.secondary) }
                                if status == .complete { Image(systemName: "checkmark.seal").foregroundStyle(LeximoryPalette.sage) }
                            }
                            ReviewAnnotatedAnswer(content: submission, feedback: feedback, language: learningLanguageName(model.selection.language))
                            if let rationale = feedback?.rationale, !rationale.isEmpty {
                                Label(rationale, systemImage: "checkmark.seal").font(LeximoryTypography.interface(16))
                            }
                            if status == .failed {
                                Text("点评暂时无法完成，请重新提交。")
                                    .font(LeximoryTypography.interface(15)).foregroundStyle(.secondary)
                            }
                        }
                    }
                    if let feedback {
                        ForEach(feedback.badPairs, id: \.self) { pair in
                            VStack(alignment: .leading, spacing: 10) {
                                Text(pair.original).strikethrough().foregroundStyle(.secondary)
                                Image(systemName: "arrow.down").font(.caption).foregroundStyle(.secondary).accessibilityHidden(true)
                                AnnotationMarkdownText(content: pair.improved, size: 17, language: learningLanguageName(model.selection.language))
                            }.padding(18).frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.yellow.opacity(0.13), in: .rect(cornerRadius: 20))
                        }
                        ForEach(feedback.goodPairs ?? [], id: \.self) { pair in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(pair.original).editorialFont(19, relativeTo: .body, language: learningLanguageName(model.selection.language))
                                Text(pair.note).font(LeximoryTypography.interface(16)).foregroundStyle(.secondary)
                            }.padding(18).frame(maxWidth: .infinity, alignment: .leading)
                                .background(LeximoryPalette.sage.opacity(0.08), in: .rect(cornerRadius: 20))
                        }
                    }
                    if let reply = conversation?.reply, status == .complete {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("小黑猫的回应").font(LeximoryTypography.interface(13)).foregroundStyle(.secondary)
                            AnnotationMarkdownText(content: reply, size: 18, language: learningLanguageName(model.selection.language))
                        }.padding(22).frame(maxWidth: .infinity, alignment: .leading)
                            .background(LeximoryPalette.cover, in: .rect(cornerRadius: 26))
                    }
                    if let translation, status == .complete {
                        DisclosureGroup("参考译文", isExpanded: $showReference) {
                            AnnotationMarkdownText(content: translation.answer, size: 18, language: learningLanguageName(model.selection.language))
                                .padding(.top, 14)
                        }.font(LeximoryTypography.interface(15)).disabled(status != .complete)
                    }
                    if savedSubmission != nil && !editing && status != .failed {
                        Button("修改回答", systemImage: "pencil") { editing = true; focused = true }
                            .font(LeximoryTypography.interface(16)).disabled(sync?.online == false || locked || model.submitting || model.awaitingConfirmation || status == .pending)
                    }
                    if let error = model.error { Text(error).font(LeximoryTypography.interface(15)).foregroundStyle(.secondary) }
                }.padding(22).frame(maxWidth: .infinity, alignment: .leading)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
            }.frame(height: min(contentHeight, max(90, availableHeight - editorHeight - 48)))
                .scrollBounceBehavior(.basedOnSize).scrollDismissesKeyboard(.interactively)
                .background(LeximoryPalette.shell.opacity(0.96), in: .rect(cornerRadius: 32))
                .overlay { RoundedRectangle(cornerRadius: 32).strokeBorder(ReviewStyle.segment, lineWidth: 7) }
                .accessibilityIdentifier("review-translation-tray")
            Spacer(minLength: 0)
            if savedSubmission == nil || editing || status == .failed { composer }
        }.frame(maxWidth: 640).frame(maxWidth: .infinity).tint(.primary)
            .onChange(of: status) { _, value in if value == .complete { showReference = true } }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            ZStack(alignment: .topLeading) {
                if draft.wrappedValue.isEmpty {
                    Text(index == nil ? "写给小黑猫的话……" : model.selection.language == "zh" ? "译成文言文……" : "Your translation here ...")
                        .font(ReviewStyle.mono(16)).foregroundStyle(LeximoryPalette.secondaryLabel)
                        .padding(.horizontal, 5).padding(.top, 8).allowsHitTesting(false)
                }
                TextEditor(text: draft).font(ReviewStyle.mono(16)).frame(height: editorHeight)
                    .scrollContentBackground(.hidden).focused($focused)
                    .disabled(sync?.online == false || locked || model.submitting || model.awaitingConfirmation || status == .pending)
                    .accessibilityLabel(index == nil ? "写给小黑猫的话" : "你的翻译")
            }
            Button {
                focused = false
                Task { await model.submit(index: index, text: draft.wrappedValue); editing = false }
            } label: {
                Group {
                    if model.submitting || model.awaitingConfirmation { ProgressView().tint(LeximoryPalette.paper) }
                    else { Image(systemName: "arrow.up").font(.system(size: 16)) }
                }.foregroundStyle(LeximoryPalette.paper).frame(width: 32, height: 32)
                    .background(LeximoryPalette.ink, in: .circle).frame(width: 44, height: 44)
            }.buttonStyle(.plain).disabled(!canSubmit).opacity(canSubmit ? 1 : 0.4).accessibilityLabel("提交")
        }.padding(12).frame(maxWidth: 640)
            .background(ReviewStyle.today, in: .rect(cornerRadius: 32))
            .overlay { RoundedRectangle(cornerRadius: 32).strokeBorder(ReviewStyle.segment, lineWidth: 1) }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("review-composer")
    }
}
