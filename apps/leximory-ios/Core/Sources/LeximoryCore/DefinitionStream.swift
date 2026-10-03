import Foundation

public enum DefinitionEvent: Sendable {
    case started(String)
    case delta(String, String)
    case completed(String, Definition)
    case failed(String, MobileFailure.Detail)
    public var requestID: String {
        switch self {
        case .started(let id), .delta(let id, _), .completed(let id, _), .failed(let id, _): id
        }
    }
}
public struct DefinitionFrames: Sendable {
    private var buffer = Data()
    private var requestID: String?
    private var terminal = false
    private var bytes = 0
    public init() {}
    public mutating func append(_ chunk: Data) throws -> [DefinitionEvent] {
        bytes += chunk.count
        guard bytes <= 1_048_576 else { throw URLError(.dataLengthExceedsMaximum) }
        buffer.append(chunk)
        var events: [DefinitionEvent] = []
        while let newline = buffer.firstIndex(of: 10) {
            let record = Data(buffer[..<newline])
            buffer.removeSubrange(...newline)
            guard !record.isEmpty, record.count <= 65536, !terminal else { throw URLError(.cannotParseResponse) }
            // Validate the wire union with the generated decoder before projecting
            // it into the small feature enum used by the presentation model.
            _ = try JSONDecoder().decode(Components.Schemas.DefinitionFrame.self, from: record)
            let frame = try JSONDecoder().decode(WireFrame.self, from: record)
            let event = try frame.event()
            switch event {
            case .started(let id):
                guard requestID == nil else { throw URLError(.cannotParseResponse) }
                requestID = id
            case .delta:
                guard requestID == event.requestID else { throw URLError(.cannotParseResponse) }
            case .completed, .failed:
                guard requestID == event.requestID else { throw URLError(.cannotParseResponse) }
                terminal = true
            }
            events.append(event)
        }
        guard buffer.count <= 65536 else { throw URLError(.dataLengthExceedsMaximum) }
        return events
    }
    public func finish() throws {
        guard buffer.isEmpty, terminal else { throw URLError(.cannotParseResponse) }
    }
    private struct WireFrame: Decodable {
        enum Kind: String, Decodable { case started, delta, completed, failed }
        let kind: Kind
        let requestId: String
        let text: String?
        let definition: Definition?
        let error: MobileFailure.Detail?
        func event() throws -> DefinitionEvent {
            switch kind {
            case .started: return .started(requestId)
            case .delta:
                guard let text else { throw URLError(.cannotParseResponse) }
                return .delta(requestId, text)
            case .completed:
                guard let definition, !definition.lemma.isEmpty, !definition.definition.isEmpty else { throw URLError(.cannotParseResponse) }
                return .completed(requestId, definition)
            case .failed:
                guard let error else { throw URLError(.cannotParseResponse) }
                return .failed(requestId, error)
            }
        }
    }
}
