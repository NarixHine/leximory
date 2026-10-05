import Foundation

public struct TextID: RawRepresentable, Hashable, Codable, Sendable {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
}
public struct LibraryID: RawRepresentable, Hashable, Codable, Sendable {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
}
public struct VocabularyID: RawRepresentable, Hashable, Codable, Sendable {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
}

public struct UTF16Range: Codable, Hashable, Sendable {
    public let location: Int
    public let length: Int
    public var nsRange: NSRange { NSRange(location: location, length: length) }
    public init(location: Int, length: Int) { self.location = location; self.length = length }

    public func validated(in text: String) throws -> Range<String.Index> {
        guard location >= 0, length > 0, location <= text.utf16.count,
              length <= text.utf16.count - location,
              let range = Range(nsRange, in: text) else { throw SelectionError.invalidRange }
        let boundaries = Set(text.indices).union([text.endIndex])
        guard boundaries.contains(range.lowerBound), boundaries.contains(range.upperBound) else {
            throw SelectionError.invalidRange
        }
        return range
    }
}

public enum SelectionError: Error, Equatable { case invalidRange, staleRevision, unknownBlock }

public struct Definition: Codable, Hashable, Sendable {
    public let lemma: String
    public let definition: String
    public let etymology: String?
    public let cognates: String?
    public init(lemma: String, definition: String, etymology: String? = nil, cognates: String? = nil) {
        self.lemma = lemma; self.definition = definition; self.etymology = etymology; self.cognates = cognates
    }
}

public struct RenderSpan: Codable, Hashable, Sendable {
    public enum Style: Hashable, Sendable {
        case strong, emphasis, code, smallcaps
        case link(URL), image(URL, alt: String), ruby(String), definition(Definition)
    }
    public let range: UTF16Range
    public let style: Style
    private enum CodingKeys: String, CodingKey { case kind, range, url, alt, pronunciation, lemma, definition, etymology, cognates }
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        range = try container.decode(UTF16Range.self, forKey: .range)
        let kind = try container.decode(String.self, forKey: .kind)
        switch kind {
        case "strong": style = .strong
        case "emphasis": style = .emphasis
        case "code": style = .code
        case "smallcaps": style = .smallcaps
        case "link": style = .link(try container.decode(URL.self, forKey: .url))
        case "image": style = .image(try container.decode(URL.self, forKey: .url), alt: try container.decode(String.self, forKey: .alt))
        case "ruby": style = .ruby(try container.decode(String.self, forKey: .pronunciation))
        case "definition": style = .definition(Definition(
            lemma: try container.decode(String.self, forKey: .lemma),
            definition: try container.decode(String.self, forKey: .definition),
            etymology: try container.decodeIfPresent(String.self, forKey: .etymology),
            cognates: try container.decodeIfPresent(String.self, forKey: .cognates)))
        default: throw DecodingError.dataCorruptedError(forKey: .kind, in: container, debugDescription: "Unsupported render span")
        }
    }
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(range, forKey: .range)
        let kind: String
        switch style {
        case .strong: kind = "strong"
        case .emphasis: kind = "emphasis"
        case .code: kind = "code"
        case .smallcaps: kind = "smallcaps"
        case .link(let url): kind = "link"; try container.encode(url, forKey: .url)
        case .image(let url, let alt):
            kind = "image"; try container.encode(url, forKey: .url); try container.encode(alt, forKey: .alt)
        case .ruby(let pronunciation): kind = "ruby"; try container.encode(pronunciation, forKey: .pronunciation)
        case .definition(let definition):
            kind = "definition"
            try container.encode(definition.lemma, forKey: .lemma)
            try container.encode(definition.definition, forKey: .definition)
            try container.encodeIfPresent(definition.etymology, forKey: .etymology)
            try container.encodeIfPresent(definition.cognates, forKey: .cognates)
        }
        try container.encode(kind, forKey: .kind)
    }

}

public struct RenderBlock: Codable, Hashable, Identifiable, Sendable {
    public enum Kind: String, Codable, Sendable {
        case paragraph, heading1, heading2, heading3, heading4, heading5, heading6
        case quote, listItem, code, fallback, divider
    }
    public let id: String
    public let kind: Kind
    public let sourceRange: UTF16Range
    public let displayText: String
    public let spans: [RenderSpan]
    public let audioId: String?
    public let notice: String?
}

/// Feasibility contract. The HTTP DTOs will be generator-owned at gate 2.
public struct ReadingDocument: Codable, Hashable, Sendable {
    public let version: Int
    public let revision: String
    public let source: String
    public let blocks: [RenderBlock]

    public func validate() throws {
        guard version == 1, revision.count == 64,
              revision.allSatisfy({ "0123456789abcdef".contains($0) }),
              Set(blocks.map(\.id)).count == blocks.count else { throw SelectionError.invalidRange }
        var sourceBoundaries: Set<Int> = [0]
        var offset = 0
        for character in source {
            offset += String(character).utf16.count
            sourceBoundaries.insert(offset)
        }
        for block in blocks {
            let range = block.sourceRange
            guard range.location >= 0, range.length > 0, range.location <= offset,
                  range.length <= offset - range.location,
                  sourceBoundaries.contains(range.location), sourceBoundaries.contains(range.location + range.length) else {
                throw SelectionError.invalidRange
            }
            for span in block.spans { _ = try span.range.validated(in: block.displayText) }
        }
    }

    public func selection(textID: TextID, blockID: String, range: UTF16Range) throws -> ReadingSelection {
        guard let block = blocks.first(where: { $0.id == blockID }) else { throw SelectionError.unknownBlock }
        let nativeRange = try range.validated(in: block.displayText)
        return ReadingSelection(textID: textID, revision: revision, blockID: blockID, range: range,
                                text: String(block.displayText[nativeRange]))
    }
}

public struct ReadingSelection: Hashable, Identifiable, Sendable {
    public let textID: TextID
    public let revision: String
    public let blockID: String
    public let range: UTF16Range
    public let text: String
    public var id: String { "\(textID.rawValue):\(revision):\(blockID):\(range.location):\(range.length)" }
}

/// Maps a selection from the single TextKit document into one canonical block.
public struct ReaderLayout: Sendable {
    public struct Annotation: Sendable {
        public let range: NSRange
        public let selection: ReadingSelection
        public let definition: Definition
        public var tag: String { "definition:\(selection.blockID):\(selection.range.location)" }
    }
    public struct Entry: Sendable {
        public let block: RenderBlock
        public let documentRange: NSRange
    }
    public struct Notice: Sendable {
        public let range: NSRange
        public let text: String
    }
    public let text: String
    public let entries: [Entry]
    public let notices: [Notice]
    public init(document: ReadingDocument, openingTitleInHeader: String? = nil, showsNotices: Bool = true) {
        var text = ""
        var entries: [Entry] = []
        var notices: [Notice] = []
        for (index, block) in document.blocks.enumerated() {
            if index == 0, block.kind == .heading1, block.displayText == openingTitleInHeader,
               block.spans.isEmpty, block.notice == nil { continue }
            if !text.isEmpty { text += "\n" }
            if showsNotices, let notice = block.notice {
                notices.append(Notice(range: NSRange(location: text.utf16.count, length: notice.utf16.count), text: notice))
                text += notice + "\n"
            }
            entries.append(Entry(block: block, documentRange: NSRange(location: text.utf16.count, length: block.displayText.utf16.count)))
            text += block.displayText
        }
        self.text = text; self.entries = entries; self.notices = notices
    }
    public func selection(_ range: NSRange, document: ReadingDocument, textID: TextID) throws -> ReadingSelection {
        guard range.location >= 0, range.length > 0,
              let entry = entries(intersecting: range).first,
              range.location >= entry.documentRange.location,
              range.length <= NSMaxRange(entry.documentRange) - range.location else { throw SelectionError.invalidRange }
        let local = UTF16Range(location: range.location - entry.documentRange.location, length: range.length)
        let indices = try local.validated(in: entry.block.displayText)
        return ReadingSelection(textID: textID, revision: document.revision, blockID: entry.block.id,
                                range: local, text: String(entry.block.displayText[indices]))
    }
    public func entries(intersecting range: NSRange) -> ArraySlice<Entry> {
        guard range.location >= 0, range.length > 0, range.length <= Int.max - range.location else { return [] }
        var lower = 0, upper = entries.count
        while lower < upper {
            let middle = (lower + upper) / 2
            if NSMaxRange(entries[middle].documentRange) <= range.location { lower = middle + 1 }
            else { upper = middle }
        }
        let start = lower
        while lower < entries.count, entries[lower].documentRange.location < NSMaxRange(range) { lower += 1 }
        return entries[start..<lower]
    }
    public func annotations(textID: TextID, revision: String) -> [Annotation] {
        entries.flatMap { entry in
            entry.block.spans.compactMap { span in
                guard case .definition(let definition) = span.style,
                      let indices = try? span.range.validated(in: entry.block.displayText) else { return nil }
                return Annotation(range: NSRange(location: entry.documentRange.location + span.range.location, length: span.range.length),
                    selection: ReadingSelection(textID: textID, revision: revision, blockID: entry.block.id,
                        range: span.range, text: String(entry.block.displayText[indices])), definition: definition)
            }
        }
    }
}
