import SwiftUI
import UIKit

struct AnnotationMarkdownText: View {
    let content: String
    let size: CGFloat
    let language: String
    @ScaledMetric(relativeTo: .body) private var scale = 1.0

    var body: some View {
        if content.localizedCaseInsensitiveContains("<ruby") {
            RubyAnnotationText(content: content, size: size * scale, language: language)
        } else {
            Text(annotationMarkdown(content, size: size * scale))
                .font(LeximoryTypography.prose(size, language: language))
                .lineSpacing(3).textSelection(.enabled)
        }
    }
}

@MainActor struct AnnotationMarkdownLayout {
    struct Ruby { let range: NSRange; let text: String }
    let attributed: NSAttributedString
    let rubies: [Ruby]

    init(content: String, size: CGFloat, language: String) {
        let pattern = #"<ruby\b[^>]*>([\s\S]*?)<rt\b[^>]*>([\s\S]*?)</rt>([\s\S]*?)</ruby>"#
        let regex = try! NSRegularExpression(pattern: pattern, options: .caseInsensitive)
        let source = content as NSString
        var masked = content
        var tokens: [(String, String, String)] = []
        for (index, match) in regex.matches(in: content, range: NSRange(location: 0, length: source.length)).enumerated().reversed() {
            var token = "LEXIMORYRUBY\(index)TOKEN"
            while content.contains(token) { token += "X" }
            let base = Self.plain(source.substring(with: match.range(at: 1)) + source.substring(with: match.range(at: 3)))
            let pronunciation = Self.plain(source.substring(with: match.range(at: 2)))
            tokens.append((token, base, pronunciation))
            masked = (masked as NSString).replacingCharacters(in: match.range, with: token)
        }
        let parsed = (try? AttributedString(markdown: masked, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(masked)
        let output = NSMutableAttributedString()
        let baseFont = LeximoryTypography.proseUI(size, language: language)
        for run in parsed.runs {
            var font = baseFont
            var traits: UIFontDescriptor.SymbolicTraits = []
            let intent = run.inlinePresentationIntent ?? []
            if intent.contains(.stronglyEmphasized) { traits.insert(.traitBold) }
            if intent.contains(.emphasized) { traits.insert(.traitItalic) }
            if let descriptor = font.fontDescriptor.withSymbolicTraits(traits), !traits.isEmpty {
                font = UIFont(descriptor: descriptor, size: size)
            }
            if intent.contains(.code) { font = LeximoryTypography.face("SourceCodePro-Medium", size: size * 0.85) }
            var attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: LeximoryPalette.readingInkUI]
            if intent.contains(.stronglyEmphasized), !font.fontDescriptor.symbolicTraits.contains(.traitBold) {
                attributes[.strokeWidth] = -2.5
            }
            if intent.contains(.emphasized), !font.fontDescriptor.symbolicTraits.contains(.traitItalic) {
                attributes[.obliqueness] = 0.15
            }
            if let link = run.link { attributes[.link] = link }
            output.append(NSAttributedString(string: String(parsed[run.range].characters), attributes: attributes))
        }
        var rubies: [Ruby] = []
        // Replace in document order so canonical ranges include only baseline text.
        while let next = tokens.compactMap({ token, base, reading -> (NSRange, String, String)? in
            let range = (output.string as NSString).range(of: token)
            return range.location == NSNotFound ? nil : (range, base, reading)
        }).min(by: { $0.0.location < $1.0.location }) {
            output.replaceCharacters(in: next.0, with: next.1)
            rubies.append(Ruby(range: NSRange(location: next.0.location, length: next.1.utf16.count), text: next.2))
        }
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = rubies.isEmpty ? 3 : size * 0.65
        output.addAttribute(.paragraphStyle, value: paragraph, range: NSRange(location: 0, length: output.length))
        self.attributed = output; self.rubies = rubies
    }

    private static func plain(_ text: String) -> String {
        text.replacingOccurrences(of: #"<rp\b[^>]*>[\s\S]*?</rp>"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"<[^>]+>"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: "&lt;", with: "<").replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"").replacingOccurrences(of: "&amp;", with: "&")
    }
}

private struct RubyAnnotationText: UIViewRepresentable {
    let content: String
    let size: CGFloat
    let language: String

    func makeUIView(context: Context) -> AnnotationRubyTextView {
        let view = AnnotationRubyTextView()
        view.isEditable = false; view.isScrollEnabled = false; view.backgroundColor = .clear
        view.textContainer.lineFragmentPadding = 0
        view.accessibilityIdentifier = "annotation-markdown-ruby"
        view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return view
    }
    func updateUIView(_ view: AnnotationRubyTextView, context: Context) {
        let layout = AnnotationMarkdownLayout(content: content, size: size, language: language)
        view.rubies = layout.rubies
        view.rubyFont = LeximoryTypography.proseUI(size * 0.48, language: "Japanese")
        view.textContainerInset = UIEdgeInsets(top: view.rubyFont.lineHeight, left: 0, bottom: 0, right: 0)
        if !view.attributedText.isEqual(to: layout.attributed) { view.attributedText = layout.attributed }
        view.setNeedsLayout()
    }
    func sizeThatFits(_ proposal: ProposedViewSize, uiView: AnnotationRubyTextView, context: Context) -> CGSize? {
        guard let width = proposal.width, width > 0 else { return nil }
        return uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
    }
}

private final class AnnotationRubyTextView: UITextView {
    var rubies: [AnnotationMarkdownLayout.Ruby] = []
    var rubyFont = UIFont.systemFont(ofSize: 9)
    private var labels: [UILabel] = []
    override func layoutSubviews() {
        super.layoutSubviews()
        while labels.count < rubies.count {
            let label = UILabel(); label.isUserInteractionEnabled = false; label.isAccessibilityElement = false
            label.textAlignment = .center; label.textColor = .secondaryLabel
            addSubview(label); labels.append(label)
        }
        for (index, label) in labels.enumerated() {
            guard index < rubies.count else { label.isHidden = true; continue }
            let ruby = rubies[index]
            guard let start = position(from: beginningOfDocument, offset: ruby.range.location),
                  let end = position(from: start, offset: ruby.range.length), let range = textRange(from: start, to: end) else { label.isHidden = true; continue }
            let base = firstRect(for: range)
            label.isHidden = base.isEmpty
            label.text = ruby.text; label.font = rubyFont
            let width = max(base.width, label.sizeThatFits(.zero).width)
            label.frame = CGRect(x: base.midX - width / 2, y: base.minY - rubyFont.lineHeight,
                                 width: width, height: rubyFont.lineHeight)
        }
    }
}
