import Foundation
import OpenAPIRuntime
import os

enum DefinitionStreaming {
    static func events(
        body: @escaping @Sendable () async throws -> HTTPBody,
        pause: @escaping @Sendable (Int) async throws -> Void = MutationRetry.pause
    ) -> AsyncThrowingStream<DefinitionEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                for attempt in 0..<MutationRetry.maxAttempts {
                    do {
                        try Task.checkCancellation()
                        let response = try await body()
                        var decoder = DefinitionFrames()
                        func emit(_ events: [DefinitionEvent]) throws -> Bool {
                            for event in events {
                                if case .failed(let id, let failure) = event {
                                    Logger(subsystem: "com.leximory.reader", category: "api").error("Definition failed: id=\(id, privacy: .public) code=\(failure.code, privacy: .public)")
                                    throw MobileFailure(error: failure)
                                }
                                continuation.yield(event)
                                if case .completed = event { return true }
                            }
                            return false
                        }
                        for try await chunk in response {
                            try Task.checkCancellation()
                            if try emit(decoder.append(Data(chunk))) {
                                continuation.finish()
                                return
                            }
                        }
                        try Task.checkCancellation()
                        _ = try emit(decoder.finishEvents())
                        continuation.finish()
                        return
                    } catch {
                        guard !Task.isCancelled, attempt + 1 < MutationRetry.maxAttempts,
                              MutationRetry.isRetryable(error) else {
                            continuation.finish(throwing: error)
                            return
                        }
                        do { try await pause(attempt) }
                        catch {
                            continuation.finish(throwing: error)
                            return
                        }
                    }
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

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
    mutating func finishEvents() throws -> [DefinitionEvent] {
        do {
            let events = buffer.isEmpty ? [] : try append(Data([10]))
            try finish()
            return events
        } catch is DecodingError {
            throw URLError(.cannotParseResponse)
        }
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
