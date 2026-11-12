import Foundation
import CryptoKit

public struct EbookAnnotationUnit: Codable, Hashable, Sendable {
    public let location: String
    public let text: String
    public init(location: String, text: String) { self.location = location; self.text = text }
    public var id: String {
        SHA256.hash(data: Data((location + "\n" + text).utf8)).map { String(format: "%02x", $0) }.joined()
    }
    public static func pdfPage(_ page: Int, text: String) -> [Self] {
        let source = text as NSString
        var offset = 0, units: [Self] = []
        while offset < source.length {
            var end = min(source.length, offset + 1600)
            if end < source.length { end = NSMaxRange(source.rangeOfComposedCharacterSequence(at: end - 1)) }
            let value = source.substring(with: NSRange(location: offset, length: end - offset))
            if !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { units.append(Self(location: "pdf:\(page):\(offset)", text: value)) }
            offset = end
        }
        return units
    }
}
public struct EbookAnnotation: Codable, Hashable, Identifiable, Sendable {
    public let id: String
    public let quote: String
    public let start: Int
    public let length: Int
    public let definition: Definition
    public init(id: String, quote: String, start: Int, length: Int, definition: Definition) {
        self.id = id; self.quote = quote; self.start = start; self.length = length; self.definition = definition
    }
}
public struct EbookAnnotationPage: Codable, Sendable {
    public var unitId: String
    public var annotations: [EbookAnnotation]
    public var complete: Bool
    public init(unitId: String, annotations: [EbookAnnotation] = [], complete: Bool = false) {
        self.unitId = unitId; self.annotations = annotations; self.complete = complete
    }
}
public enum EbookAnnotationEvent: Sendable {
    case annotation(unitID: String, EbookAnnotation)
    case complete(unitID: String)
    case failed(MobileFailure.Detail)
}
public struct EbookAnnotationFrames: Sendable {
    private var buffer = Data()
    private var terminal = false
    private var bytes = 0
    private var unitID: String?
    public init() {}
    public mutating func append(_ data: Data) throws -> [EbookAnnotationEvent] {
        bytes += data.count
        guard bytes <= 2_097_152 else { throw URLError(.dataLengthExceedsMaximum) }
        buffer.append(data)
        var events: [EbookAnnotationEvent] = []
        while let newline = buffer.firstIndex(of: 10) {
            let line = Data(buffer[..<newline]); buffer.removeSubrange(...newline)
            guard !line.isEmpty, line.count <= 65536, !terminal else { throw URLError(.cannotParseResponse) }
            let value = try JSONDecoder().decode(Frame.self, from: line)
            guard unitID == nil || unitID == value.unitId else { throw URLError(.cannotParseResponse) }
            unitID = value.unitId
            switch value.kind {
            case .annotation:
                guard let annotation = value.annotation, annotation.start >= 0, annotation.length > 0,
                      annotation.length == annotation.quote.utf16.count, !annotation.definition.definition.isEmpty else { throw URLError(.cannotParseResponse) }
                events.append(.annotation(unitID: value.unitId, annotation))
            case .complete: terminal = true; events.append(.complete(unitID: value.unitId))
            case .failed:
                guard let error = value.error else { throw URLError(.cannotParseResponse) }
                terminal = true; events.append(.failed(error))
            }
        }
        guard buffer.count <= 65536 else { throw URLError(.dataLengthExceedsMaximum) }
        return events
    }
    public func finish() throws { guard terminal, buffer.isEmpty else { throw URLError(.cannotParseResponse) } }
    private struct Frame: Decodable {
        enum Kind: String, Decodable { case annotation, complete, failed }
        let kind: Kind
        let unitId: String
        let annotation: EbookAnnotation?
        let error: MobileFailure.Detail?
    }
}
