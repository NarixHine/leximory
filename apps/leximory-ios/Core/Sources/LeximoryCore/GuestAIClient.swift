import Foundation
import OpenAPIRuntime
import OpenAPIURLSession
import HTTPTypes

public struct GuestAllowance: Codable, Sendable {
    public let used: Int
    public let limit: Int
    public let resetsAt: String
    public var remaining: Int { max(0, limit - used) }
}

public struct GuestCredential: Codable, Sendable {
    public let token: String
    public let expiresAt: String
    public let allowance: GuestAllowance
    public var isExpired: Bool {
        let date = (try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(expiresAt))
            ?? (try? Date.ISO8601FormatStyle().parse(expiresAt))
        return date.map { $0 <= .now } ?? true
    }
}

public struct GuestDefinitionInput: Codable, Sendable {
    public let requestId: String
    public let quote: String
    public let context: String
    public let offset: Int
    public let language: String?
    public let accent: String?

    public init(requestID: String, quote: String, context: String, offset: Int, language: String? = nil, accent: String? = nil) throws {
        guard !quote.isEmpty, quote.utf16.count <= 1024, offset >= 0, offset <= context.utf16.count,
              quote.utf16.count <= context.utf16.count - offset,
              let selection = Range(NSRange(location: offset, length: quote.utf16.count), in: context),
              String(context[selection]) == quote else { throw URLError(.cannotParseResponse) }
        var beforeCount = 0
        let before = String(context[..<selection.lowerBound].reversed().prefix { character in
            beforeCount += String(character).utf16.count
            return beforeCount <= 1200
        }.reversed())
        var afterCount = 0
        let after = String(context[selection.upperBound...].prefix { character in
            afterCount += String(character).utf16.count
            return afterCount <= 1200
        })
        self.requestId = requestID
        self.quote = quote
        self.context = String(before) + quote + String(after)
        self.offset = before.utf16.count
        self.language = language
        self.accent = accent
    }
}

public struct GuestDefinitionResult: Decodable, Sendable {
    public enum State: String, Decodable, Sendable { case running, completed, failed }
    public let state: State
    public let requestId: String
    public let language: String?
    public let definition: Definition?
    public let error: MobileFailure.Detail?
    public let allowance: GuestAllowance
}

public struct GuestAIClient: Sendable {
    private let baseURL: URL
    private let transport: any ClientTransport

    public init(baseURL: URL, transport: any ClientTransport = URLSessionTransport()) {
        self.baseURL = baseURL.appending(path: "api/mobile/v1")
        self.transport = transport
    }

    public func createSession() async throws -> GuestCredential {
        try await json(path: "/guest/session", method: .post, token: nil, data: Data("{}".utf8))
    }

    public func revoke(token: String) async throws {
        struct Receipt: Decodable { let deleted: Bool }
        let receipt: Receipt = try await json(path: "/guest/session/revoke", method: .post, token: token, data: Data("{}".utf8))
        guard receipt.deleted else { throw URLError(.badServerResponse) }
    }

    public func result(requestID: String, token: String) async throws -> GuestDefinitionResult {
        guard UUID(uuidString: requestID) != nil else { throw URLError(.badURL) }
        return try await json(path: "/guest/definitions/\(requestID)", method: .get, token: token)
    }

    public func definitions(_ input: GuestDefinitionInput, token: String) -> AsyncThrowingStream<DefinitionEvent, Error> {
        DefinitionStreaming.events {
            let (response, body) = try await send(path: "/guest/definitions", method: .post, token: token,
                data: JSONEncoder().encode(input))
            try await check(response, body: body)
            guard let body else { throw URLError(.badServerResponse) }
            return body
        }
    }

    private func json<Value: Decodable>(path: String, method: HTTPRequest.Method, token: String?, data: Data? = nil) async throws -> Value {
        let (response, body) = try await send(path: path, method: method, token: token, data: data)
        try await check(response, body: body)
        guard let body else { throw URLError(.badServerResponse) }
        let data = try await Data(collecting: body, upTo: 1_048_576)
        return try JSONDecoder().decode(Value.self, from: data)
    }

    private func send(path: String, method: HTTPRequest.Method, token: String?, data: Data?) async throws -> (HTTPResponse, HTTPBody?) {
        var request = HTTPRequest(method: method, scheme: baseURL.scheme, authority: baseURL.host, path: path)
        request.headerFields[.contentType] = "application/json"
        if let token { request.headerFields[.authorization] = "Bearer \(token)" }
        return try await transport.send(request, body: data.map { HTTPBody($0) }, baseURL: baseURL, operationID: "guest")
    }

    private func check(_ response: HTTPResponse, body: HTTPBody?) async throws {
        guard !(200..<300).contains(response.status.code) else { return }
        if let body {
            let data = try await Data(collecting: body, upTo: 65536)
            if let failure = try? JSONDecoder().decode(MobileFailure.self, from: data) { throw failure }
        }
        throw URLError(.badServerResponse)
    }
}
