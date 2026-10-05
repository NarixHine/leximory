import Foundation
import HTTPTypes
import OpenAPIRuntime

/// Shares only concurrent GETs. Mutations and streaming definitions are never replayed.
actor ReadCoalescingTransport: ClientTransport {
    private let upstream: any ClientTransport
    private struct Response: Sendable { let headers: HTTPResponse; let data: Data? }
    private var requests: [String: Task<Response, Error>] = [:]
    init(_ upstream: any ClientTransport) { self.upstream = upstream }
    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        guard request.method == .get else { return try await upstream.send(request, body: body, baseURL: baseURL, operationID: operationID) }
        let key = baseURL.absoluteString + (request.path ?? "") + (request.headerFields[.authorization] ?? "")
        if let pending = requests[key] {
            let response = try await pending.value
            try Task.checkCancellation()
            return (response.headers, response.data.map { HTTPBody($0) })
        }
        let task = Task { [upstream] in
            let (headers, body) = try await upstream.send(request, body: body, baseURL: baseURL, operationID: operationID)
            let data: Data?
            if let body { data = try await Data(collecting: body, upTo: 24 * 1024 * 1024) }
            else { data = nil }
            return Response(headers: headers, data: data)
        }
        requests[key] = task
        defer { requests[key] = nil }
        let response = try await task.value
        try Task.checkCancellation()
        return (response.headers, response.data.map { HTTPBody($0) })
    }
}
