import SwiftUI
import LeximoryCore

struct ReviewExerciseView: View {
    @Bindable var model: ReviewModel
    let index: Int?
    let availableHeight: CGFloat
    @State private var contentHeight: CGFloat = 160
    @State private var editing = false
    @State private var focused = false
    @FocusState private var writingFocused: Bool
    @Environment(\.nativeSync) private var sync
    @ScaledMetric(relativeTo: .body) private var editorHeight: CGFloat = 50
    @ScaledMetric(relativeTo: .caption) private var translationFontSize: CGFloat = 16
    private var translationFont: UIFont { LeximoryTypography.face("SpaceMono-Regular", size: translationFontSize) }
    private var inputHeight: CGFloat { index == nil ? editorHeight : max(editorHeight, translationFont.lineHeight * 2 + 16) }

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
                        AnnotationMarkdownText(content: translation?.prompt ?? conversation?.prompt ?? "", size: 16, language: index == nil ? learningLanguageName(model.selection.language) : "Chinese")
                        if let translation {
                            Text("（\(translation.keyword)）").font(LeximoryTypography.prose(16, language: learningLanguageName(model.selection.language))).foregroundStyle(ReviewStyle.word)
                        }
                        if let keywords = conversation?.keywords, !keywords.isEmpty {
                            Text("不妨试试选用 \(keywords.prefix(6).joined(separator: " / "))")
                                .interfaceFont(15).foregroundStyle(.secondary)
                        }
                    }
                    if locked {
                        VStack(alignment: .leading, spacing: 12) {
                            Label("完成六成翻译，小黑猫就会轻声回应。", systemImage: "lock")
                            Text("完成翻译 \(model.snapshot?.completedTranslations ?? 0)/\(model.snapshot?.translations?.count ?? 0)")
                                .foregroundStyle(.secondary)
                        }.interfaceFont(16).padding(22)
                            .frame(maxWidth: .infinity, alignment: .leading).background(LeximoryPalette.cover, in: .rect(cornerRadius: 24))
                    }
                    if let submission = savedSubmission, !editing {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("你的回答").interfaceFont(13).foregroundStyle(.secondary)
                                Spacer()
                                if status == .pending { ProgressView(); Text("正在点评").interfaceFont(13).foregroundStyle(.secondary) }
                                if status == .complete { Image(systemName: "checkmark.seal").foregroundStyle(LeximoryPalette.sage) }
                            }
                            ReviewAnnotatedAnswer(content: submission, feedback: feedback, language: learningLanguageName(model.selection.language))
                            if let rationale = feedback?.rationale, !rationale.isEmpty {
                                Label(rationale, systemImage: "checkmark.seal").interfaceFont(16)
                            }
                            if status == .failed {
                                Text("点评暂时无法完成，请重新提交。")
                                    .interfaceFont(15).foregroundStyle(.secondary)
                            }
                        }
                    }
                    if let reply = conversation?.reply, status == .complete {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("小黑猫的回应").interfaceFont(13).foregroundStyle(.secondary)
                            AnnotationMarkdownText(content: reply, size: 18, language: learningLanguageName(model.selection.language))
                        }.padding(22).frame(maxWidth: .infinity, alignment: .leading)
                            .background(LeximoryPalette.cover, in: .rect(cornerRadius: 26))
                    }
                    if let translation, status == .complete {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("参考译文").interfaceFont(13).foregroundStyle(.secondary)
                            AnnotationMarkdownText(content: translation.answer, size: 18, language: learningLanguageName(model.selection.language))
                        }.accessibilityIdentifier("review-reference-answer")
                    }
                    if savedSubmission != nil && !editing && status != .failed {
                        Button("修改回答", systemImage: "pencil") {
                            editing = true
                            if index == nil { writingFocused = true } else { focused = true }
                        }
                            .interfaceFont(16).disabled(sync?.online == false || locked || model.submitting || model.awaitingConfirmation || status == .pending)
                    }
                    if let error = model.error { Text(error).interfaceFont(15).foregroundStyle(.secondary) }
                }.padding(22).frame(maxWidth: .infinity, alignment: .leading)
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
            }.frame(height: min(contentHeight, max(90, availableHeight - inputHeight - 48)))
                .scrollBounceBehavior(.basedOnSize).scrollDismissesKeyboard(.interactively)
                .background(LeximoryPalette.shell.opacity(0.96), in: .rect(cornerRadius: 32))
                .overlay { RoundedRectangle(cornerRadius: 32).strokeBorder(ReviewStyle.segment, lineWidth: 7) }
                .accessibilityIdentifier("review-translation-tray")
            Spacer(minLength: 0)
            if savedSubmission == nil || editing || status == .failed { composer }
        }.frame(maxWidth: 640).frame(maxWidth: .infinity).tint(.primary)
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            ZStack(alignment: .topLeading) {
                if draft.wrappedValue.isEmpty {
                    Text(index == nil ? "写给小黑猫的话……" : model.selection.language == "zh" ? "译成文言文……" : "Your translation here ...")
                        .font(ReviewStyle.mono(16)).foregroundStyle(LeximoryPalette.secondaryLabel)
                        .padding(.horizontal, 5).padding(.top, 8).allowsHitTesting(false)
                }
                if index != nil {
                    ReviewTranslationInput(text: draft, focused: $focused, font: translationFont,
                        enabled: sync?.online != false && !model.submitting && !model.awaitingConfirmation && status != .pending, submit: submit)
                        .frame(height: inputHeight)
                } else {
                    TextEditor(text: draft).tint(.blue).font(ReviewStyle.mono(16)).frame(height: inputHeight)
                        .scrollContentBackground(.hidden).focused($writingFocused)
                        .disabled(sync?.online == false || locked || model.submitting || model.awaitingConfirmation || status == .pending)
                        .accessibilityLabel("写给小黑猫的话")
                }
            }
            Button(action: submit) {
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
    private func submit() {
        guard canSubmit else { return }
        focused = false
        writingFocused = false
        Task { await model.submit(index: index, text: draft.wrappedValue); editing = false }
    }
}

private struct ReviewTranslationInput: UIViewRepresentable {
    @Binding var text: String
    @Binding var focused: Bool
    let font: UIFont
    let enabled: Bool
    let submit: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> FocusView {
        let view = FocusView()
        view.tintColor = .systemBlue
        view.delegate = context.coordinator
        view.backgroundColor = .clear
        view.textContainerInset = UIEdgeInsets(top: 8, left: 0, bottom: 8, right: 0)
        view.returnKeyType = .send
        view.enablesReturnKeyAutomatically = true
        view.accessibilityLabel = "你的翻译"
        return view
    }
    func updateUIView(_ view: FocusView, context: Context) {
        context.coordinator.input = self
        context.coordinator.updating = true
        defer { context.coordinator.updating = false }
        if view.text != text { view.text = text }
        view.wantsFocus = focused
        if view.font != font { view.font = font }
        view.textColor = .label
        if view.isEditable != enabled { view.isEditable = enabled }
        if focused, !view.isFirstResponder, view.window != nil { view.becomeFirstResponder() }
        else if !focused, view.isFirstResponder { view.resignFirstResponder() }
    }
    static func dismantleUIView(_ view: FocusView, coordinator: Coordinator) {
        view.delegate = nil
        view.resignFirstResponder()
    }
    final class FocusView: UITextView {
        var wantsFocus = false
        override func didMoveToWindow() {
            super.didMoveToWindow()
            if window != nil, wantsFocus, isEditable, !isFirstResponder { becomeFirstResponder() }
        }
    }
    final class Coordinator: NSObject, UITextViewDelegate {
        var input: ReviewTranslationInput
        var updating = false
        init(_ input: ReviewTranslationInput) { self.input = input }
        func textViewDidChange(_ view: UITextView) { if !updating { input.text = view.text } }
        func textViewDidBeginEditing(_ view: UITextView) { if !updating && !input.focused { input.focused = true } }
        func textViewDidEndEditing(_ view: UITextView) { if !updating && input.focused { input.focused = false } }
        func textView(_ view: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
            if text == "\n", view.markedTextRange == nil { input.submit(); return false }
            return true
        }
    }
}
