import Foundation
import Testing
import OpenAPIRuntime
@testable import LeximoryCore

struct DefinitionStreamTests {
    private static let started = #"{"kind":"started","requestId":"first"}"# + "\n"
    private static let partial = started + #"{"kind":"delta","requestId":"first","text":"{{bank||bank||old preview"}"# + "\n"
    private static let completed = #"{"kind":"started","requestId":"second"}"# + "\n"
        + #"{"kind":"delta","requestId":"second","text":"{{bank||bank||river bank}}"}"# + "\n"
        + #"{"kind":"completed","requestId":"second","definition":{"lemma":"bank","definition":"river bank"}}"# + "\n"

    private actor Responses {
        var calls = 0
        let first: String
        let error: URLError?
        init(first: String, error: URLError? = nil) { self.first = first; self.error = error }
        func body() -> HTTPBody {
            calls += 1
            if calls > 1 { return HTTPBody(DefinitionStreamTests.completed) }
            let bytes = Array(first.utf8)
            let error = error
            let stream = AsyncThrowingStream<ArraySlice<UInt8>, Error> { continuation in
                continuation.yield(bytes[...])
                continuation.finish(throwing: error)
            }
            return HTTPBody(stream, length: .unknown, iterationBehavior: .single)
        }
    }

    @Test(arguments: ["disconnect", "truncated", "truncated-line", "service"])
    func interruptedGenerationRecoversWithANewRequest(kind: String) async throws {
        let failed = Self.partial + #"{"kind":"failed","requestId":"first","error":{"code":"service_unavailable","message":"Try again","retryable":true}}"# + "\n"
        let first = kind == "service" ? failed : Self.partial + (kind == "truncated-line" ? "{\"kind\":\"delta\",\"text\":\"cut" : "")
        let responses = Responses(first: first,
                                  error: kind == "disconnect" ? URLError(.networkConnectionLost) : nil)
        var raw = ""
        var ids: [String] = []
        var result: Definition?
        for try await event in DefinitionStreaming.events(body: { await responses.body() }, pause: { _ in }) {
            switch event {
            case .started(let id): ids.append(id); raw = ""
            case .delta(_, let text): raw += text
            case .completed(_, let definition): result = definition
            case .failed: Issue.record("Transient failure escaped recovery")
            }
        }
        #expect(await responses.calls == 2)
        #expect(ids == ["first", "second"])
        #expect(raw == "{{bank||bank||river bank}}")
        #expect(result?.definition == "river bank")
    }

    @Test(arguments: [false, true])
    func completionSurvivesMissingNewlineAndConnectionFailure(missingNewline: Bool) async throws {
        let responses = Responses(first: missingNewline ? String(Self.completed.dropLast()) : Self.completed,
                                  error: missingNewline ? nil : URLError(.networkConnectionLost))
        var completionID: String?
        for try await event in DefinitionStreaming.events(body: { await responses.body() }, pause: { _ in }) {
            if case .completed(let id, _) = event { completionID = id }
        }
        #expect(completionID == "second")
        #expect(await responses.calls == 1)
    }

    private actor Rejection {
        var calls = 0
        let retryable: Bool
        init(retryable: Bool) { self.retryable = retryable }
        func body() throws -> HTTPBody {
            calls += 1
            throw MobileFailure(error: .init(code: retryable ? "service_unavailable" : "quota_exceeded",
                                             message: "Rejected", retryable: retryable))
        }
    }

    @Test(arguments: [false, true])
    func retriesAreBoundedAndPermanentRejectionsArePreserved(retryable: Bool) async throws {
        let rejection = Rejection(retryable: retryable)
        do {
            for try await _ in DefinitionStreaming.events(body: { try await rejection.body() }, pause: { _ in }) {}
            Issue.record("Rejected stream succeeded")
        } catch {
            #expect((error as? MobileFailure)?.error.code == (retryable ? "service_unavailable" : "quota_exceeded"))
        }
        #expect(await rejection.calls == (retryable ? 3 : 1))
    }

    @Test func cancellationDuringRecoveryDoesNotRestartGeneration() async throws {
        let rejection = Rejection(retryable: true)
        let paused = AsyncStream<Void>.makeStream()
        let events = DefinitionStreaming.events(body: { try await rejection.body() }, pause: { _ in
            paused.continuation.yield(())
            try await Task.sleep(for: .seconds(60))
        })
        let consumer = Task {
            do { for try await _ in events {} }
            catch {}
        }
        for await _ in paused.stream { break }
        consumer.cancel()
        await consumer.value
        paused.continuation.finish()
        #expect(await rejection.calls == 1)
    }
}
