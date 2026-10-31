import SwiftUI
import LeximoryCore

struct ReviewAnnotatedAnswer: View {
    let content: String
    let feedback: ReviewFeedback?
    let language: String
    @State private var selected: ReviewInlineNote?
    @State private var anchor = CGRect.zero
    @ScaledMetric(relativeTo: .body) private var scale = 1.0

    var body: some View {
        ReviewAnswerText(attributed: attributed, open: open)
            .accessibilityIdentifier("review-annotated-answer")
            .popover(item: $selected, attachmentAnchor: .rect(.rect(anchor))) { note in
                VStack(alignment: .leading, spacing: 14) {
                    Text(note.title).interfaceFont(14).foregroundStyle(.secondary)
                    Text(note.original).font(LeximoryTypography.prose(20, language: language))
                    AnnotationMarkdownText(content: note.content, size: 17, language: language)
                }.padding(24).frame(idealWidth: 320, maxWidth: 360)
                    .presentationCompactAdaptation(.popover)
            }
    }
    private func open(_ url: URL, rect: CGRect) {
        guard url.scheme == "leximory-review", let index = Int(url.lastPathComponent) else { return }
        anchor = rect
        if url.host == "correction", let pairs = feedback?.badPairs, pairs.indices.contains(index) {
            selected = ReviewInlineNote(id: url.absoluteString, title: "润色建议", original: pairs[index].original, content: pairs[index].improved)
        } else if url.host == "praise", let pairs = feedback?.goodPairs, pairs.indices.contains(index) {
            selected = ReviewInlineNote(id: url.absoluteString, title: "自然的表达", original: pairs[index].original, content: pairs[index].note)
        }
    }
    private var attributed: NSAttributedString {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = 8
        let value = NSMutableAttributedString(string: content, attributes: [
            .font: LeximoryTypography.proseUI(18 * scale, language: language),
            .foregroundColor: LeximoryPalette.readingInkUI, .paragraphStyle: paragraph
        ])
        func highlight(_ original: String, color: UIColor, url: String) {
            guard !original.isEmpty else { return }
            let range = (content as NSString).range(of: original)
            guard range.location != NSNotFound, let link = URL(string: url) else { return }
            value.addAttributes([.backgroundColor: color, .link: link], range: range)
        }
        for (index, pair) in (feedback?.goodPairs ?? []).enumerated() {
            highlight(pair.original, color: UIColor.systemPink.withAlphaComponent(0.14), url: "leximory-review://praise/\(index)")
        }
        for (index, pair) in (feedback?.badPairs ?? []).enumerated() {
            highlight(pair.original, color: UIColor.systemYellow.withAlphaComponent(0.25), url: "leximory-review://correction/\(index)")
        }
        return value
    }
}

private struct ReviewAnswerText: UIViewRepresentable {
    let attributed: NSAttributedString
    let open: (URL, CGRect) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.tintColor = .systemBlue
        view.delegate = context.coordinator
        view.backgroundColor = .clear
        view.isEditable = false
        view.isScrollEnabled = false
        view.textContainerInset = .zero
        view.textContainer.lineFragmentPadding = 0
        view.linkTextAttributes = [.foregroundColor: LeximoryPalette.readingInkUI]
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tapped(_:)))
        tap.delegate = context.coordinator
        tap.cancelsTouchesInView = false
        view.addGestureRecognizer(tap)
        return view
    }
    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.parent = self
        if !view.attributedText.isEqual(to: attributed) { view.attributedText = attributed }
    }
    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        guard let width = proposal.width else { return nil }
        return uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
    }
    final class Coordinator: NSObject, UITextViewDelegate, UIGestureRecognizerDelegate {
        var parent: ReviewAnswerText
        init(_ parent: ReviewAnswerText) { self.parent = parent }
        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool { true }
        @objc func tapped(_ gesture: UITapGestureRecognizer) {
            guard gesture.state == .ended, let view = gesture.view as? UITextView,
                  let position = view.closestPosition(to: gesture.location(in: view)) else { return }
            let index = view.offset(from: view.beginningOfDocument, to: position)
            guard index >= 0, index < view.attributedText.length else { return }
            var range = NSRange()
            guard let url = view.attributedText.attribute(.link, at: index, effectiveRange: &range) as? URL else { return }
            present(url, range: range, in: view)
        }
        func textView(_ view: UITextView, primaryActionFor item: UITextItem, defaultAction: UIAction) -> UIAction? {
            guard case .link(let url) = item.content, url.scheme == "leximory-review" else { return defaultAction }
            return UIAction(title: "查看建议") { [weak self, weak view] _ in
                guard let self, let view else { return }
                self.present(url, range: item.range, in: view)
            }
        }
        private func present(_ url: URL, range: NSRange, in view: UITextView) {
            guard let start = view.position(from: view.beginningOfDocument, offset: range.location),
                  let end = view.position(from: start, offset: range.length),
                  let textRange = view.textRange(from: start, to: end) else { return }
            parent.open(url, view.firstRect(for: textRange))
        }
    }
}

private struct ReviewInlineNote: Identifiable {
    let id: String
    let title: String
    let original: String
    let content: String
}
