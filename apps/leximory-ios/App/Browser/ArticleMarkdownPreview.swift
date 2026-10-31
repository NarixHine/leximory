import SwiftUI
import LeximoryCore

@MainActor struct ArticleMarkdownDocument {
    enum Typography { case editorial, system }
    struct Block: Identifiable {
        let id: Int
        let kind: PresentationIntent.Kind
        let indentation: Int
        let quoted: Bool
        let isList: Bool
        let marker: String?
        var text = AttributedString()
        var cells: [Int: [Int: AttributedString]] = [:]
        var columns: [PresentationIntent.TableColumn] = []
        var containsImage = false
    }
    let blocks: [Block]

    static func strippingLinks(_ content: String) -> String {
        content.replacingOccurrences(of: #"(?<!!)\[([^\[]+)\]\(([^)]+)\)"#, with: "$1", options: .regularExpression)
    }

    init(content: String, size: CGFloat, language: String, typography: Typography = .editorial, bracketsInlineCode: Bool = false) {
        let source = Self.strippingLinks(content)
        let parsed = (try? AttributedString(markdown: source, options: .init(interpretedSyntax: .full))) ?? AttributedString(source)
        var output: [Block] = []
        var markedItems: Set<Int> = []
        for run in parsed.runs {
            var inline = run.inlinePresentationIntent ?? []
            if inline.contains(.inlineHTML) { continue }
            let intents = run.presentationIntent?.components ?? []
            let table = intents.first { if case .table = $0.kind { return true }; return false }
            let leaf = table ?? intents.first
            let identity = leaf?.identity ?? 0
            let kind = leaf?.kind ?? .paragraph
            if output.last?.id != identity {
                let lists = intents.filter { $0.kind == .orderedList || $0.kind == .unorderedList }
                var marker: String?
                if let itemIndex = intents.firstIndex(where: { if case .listItem = $0.kind { return true }; return false }),
                   markedItems.insert(intents[itemIndex].identity).inserted,
                   case .listItem(let ordinal) = intents[itemIndex].kind {
                    let ordered = intents.dropFirst(itemIndex + 1).first?.kind == .orderedList
                    marker = ordered ? "\(ordinal)." : "–"
                }
                var block = Block(id: identity, kind: kind, indentation: max(0, lists.count - 1), quoted: intents.contains { $0.kind == .blockQuote }, isList: !lists.isEmpty, marker: marker)
                if case .table(let columns) = kind { block.columns = columns }
                output.append(block)
            }
            let last = output.count - 1
            if intents.contains(where: { $0.kind == .tableHeaderRow }) { inline.insert(.stronglyEmphasized) }
            let text = String(parsed[run.range].characters)
            var rendered = AttributedString(bracketsInlineCode && inline.contains(.code) ? "[\(text)]" : text)
            switch typography {
            case .editorial:
                rendered.font = Font(Self.font(kind: kind, inline: inline, size: size, language: language))
            case .system:
                rendered.font = Self.systemFont(kind: kind, inline: inline, size: size)
            }
            rendered.inlinePresentationIntent = inline
            // Build new runs without link or image URL attributes. Nothing in this view navigates or fetches remote content.
            if table != nil {
                let row = intents.compactMap { component -> Int? in
                    switch component.kind { case .tableHeaderRow: return 0; case .tableRow(let index): return index; default: return nil }
                }.first ?? 0
                let column = intents.compactMap { component -> Int? in
                    if case .tableCell(let index) = component.kind { return index }; return nil
                }.first ?? 0
                output[last].cells[row, default: [:]][column, default: AttributedString()] += rendered
            } else {
                output[last].text += rendered
                output[last].containsImage = output[last].containsImage || run.imageURL != nil
            }
        }
        blocks = output
    }

    private static func systemFont(kind: PresentationIntent.Kind, inline: InlinePresentationIntent, size: CGFloat) -> Font {
        var font = Font.system(size: size)
        switch kind {
        case .header(let level): font = .system(size: size * (level == 1 ? 1.4 : 1.2), weight: .semibold)
        case .codeBlock: font = .system(size: size * 0.9, design: .monospaced)
        default: break
        }
        if inline.contains(.code) { font = .system(size: size * 0.9, design: .monospaced) }
        if inline.contains(.stronglyEmphasized) { font = font.bold() }
        if inline.contains(.emphasized) { font = font.italic() }
        return font
    }

    private static func font(kind: PresentationIntent.Kind, inline: InlinePresentationIntent, size: CGFloat, language: String) -> UIFont {
        let codeBlock: Bool = { if case .codeBlock = kind { return true }; return false }()
        if codeBlock || inline.contains(.code) {
            let font = LeximoryTypography.face("SourceCodePro-Medium", size: size * 0.85)
            return UIFont(descriptor: font.fontDescriptor.addingAttributes([.cascadeList: [UIFontDescriptor(name: "ChillDuanHeiSongRegular", size: size * 0.85)]]), size: size * 0.85)
        }
        var font: UIFont
        if case .header(let level) = kind {
            let baseSize: CGFloat
            switch level {
            case 1: baseSize = 24
            case 2: baseSize = 22
            case 3: baseSize = 20
            case 4: baseSize = 19
            case 5: baseSize = 18
            default: baseSize = 17
            }
            let headingSize = baseSize * size / 17
            font = LeximoryTypography.editorialUI(headingSize, language: language)
        } else {
            font = LeximoryTypography.proseUI(size, language: language, bold: inline.contains(.stronglyEmphasized))
        }
        if inline.contains(.emphasized), let descriptor = font.fontDescriptor.withSymbolicTraits(font.fontDescriptor.symbolicTraits.union(.traitItalic)) {
            font = UIFont(descriptor: descriptor, size: font.pointSize)
        }
        return font
    }
}

struct ArticleMarkdownPreview: View {
    let content: String
    let language: String
    var blockLimit: Int? = 5
    @State private var expanded = false
    @ScaledMetric(relativeTo: .body) private var size: CGFloat = 17
    var body: some View {
        let document = ArticleMarkdownDocument(content: content, size: size, language: language)
        VStack(alignment: .leading, spacing: 18) {
            ForEach(expanded ? document.blocks : Array(document.blocks.prefix(blockLimit ?? document.blocks.count))) { block in
                HStack(alignment: .top, spacing: 10) {
                    if block.isList { Text(block.marker ?? "").interfaceFont(size).foregroundStyle(.secondary).frame(width: 24, alignment: .trailing) }
                    blockContent(block)
                }.padding(.leading, block.quoted ? 12 : 0)
                    .overlay(alignment: .leading) {
                        if block.quoted { RoundedRectangle(cornerRadius: 1).fill(LeximoryPalette.secondaryBorder).frame(width: 3) }
                    }
                    .padding(.leading, CGFloat(block.indentation) * 18)
            }
            if let blockLimit, document.blocks.count > blockLimit {
                Button(expanded ? "收起全文" : "展开全文") { expanded.toggle() }
                    .interfaceFont(15).buttonStyle(.plain).foregroundStyle(.secondary)
            }
        }.frame(maxWidth: .infinity, alignment: .leading).foregroundStyle(.primary)
            .textSelection(.enabled).accessibilityIdentifier("article-markdown-preview")
    }
    @ViewBuilder private func blockContent(_ block: ArticleMarkdownDocument.Block) -> some View {
        switch block.kind {
        case .thematicBreak: Divider()
        case .codeBlock:
            ScrollView(.horizontal) {
                Text(block.text).fixedSize(horizontal: true, vertical: true).padding(12)
            }.background(LeximoryPalette.shell, in: RoundedRectangle(cornerRadius: 10))
        case .table:
            ScrollView(.horizontal) {
                Grid(alignment: .leading, horizontalSpacing: 18, verticalSpacing: 12) {
                    ForEach(block.cells.keys.sorted(), id: \.self) { row in
                        GridRow {
                            ForEach(Array(block.columns.indices), id: \.self) { column in
                                Text(block.cells[row]?[column] ?? AttributedString())
                                    
                                    .frame(minWidth: 80, maxWidth: 220, alignment: alignment(block.columns[column].alignment))
                                    .padding(.vertical, 6)
                                    .background(row == 0 ? LeximoryPalette.shell : Color.clear)
                            }
                        }
                    }
                }.padding(.vertical, 4)
            }
        default:
            HStack(alignment: .top, spacing: 8) {
                if block.containsImage { Image(systemName: "photo").foregroundStyle(.secondary).accessibilityHidden(true) }
                Text(block.text).lineSpacing(4).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
    private func alignment(_ alignment: PresentationIntent.TableColumn.Alignment) -> Alignment {
        switch alignment { case .left: .leading; case .center: .center; case .right: .trailing; @unknown default: .leading }
    }
}
