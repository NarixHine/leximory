import Foundation
import Network
import Testing
@testable import LeximoryCore

struct EbookFinalizationTransportTests {
    enum Operation: String, CaseIterable {
        case upload = "import"
        case replace

        var path: String {
            switch self {
            case .upload: "/api/mobile/v1/libraries/library/ebooks"
            case .replace: "/api/mobile/v1/texts/book/ebook-replace"
            }
        }
    }

    private struct GrantRequest: Decodable {
        let kind: String
        let size: Int
        let targetId: String
        let requestId: String
    }

    @Test(.timeLimit(.minutes(1)), arguments: Operation.allCases)
    func stagedEbookFinalizesOverURLSessionWithoutARequestBody(operation: Operation) async throws {
        let listener = try NWListener(using: .tcp, on: .any)
        defer { listener.cancel() }
        listener.newConnectionHandler = { connection in
            connection.start(queue: .global())
            Self.respond(on: connection, operation: operation)
        }
        let port: UInt16 = try await withCheckedThrowingContinuation { continuation in
            listener.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    listener.stateUpdateHandler = nil
                    if let port = listener.port { continuation.resume(returning: port.rawValue) }
                    else { continuation.resume(throwing: URLError(.cannotConnectToHost)) }
                case .failed(let error):
                    listener.stateUpdateHandler = nil
                    continuation.resume(throwing: error)
                default: break
                }
            }
            listener.start(queue: .global())
        }
        let origin = try #require(URL(string: "http://127.0.0.1:\(port)"))
        let client = MobileClient(baseURL: origin, token: { _ in "fixture" })
        let data = Data(count: 15_000_000)
        let book: CatalogText
        switch operation {
        case .upload:
            book = try await client.uploadEbook(libraryID: "library", title: "Book", filename: "book.pdf", data: data, requestID: "large-book")
        case .replace:
            book = try await client.replaceEbook(id: "book", filename: "book.pdf", data: data, requestID: "large-book")
        }
        #expect(book.id == "book")
    }

    private static func respond(on connection: NWConnection, operation: Operation, buffered: Data = Data()) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { received, _, complete, error in
            guard let received, error == nil else { connection.cancel(); return }
            let request = buffered + received
            guard request.count < 8192 else { connection.cancel(); return }
            guard let headerEnd = request.range(of: Data("\r\n\r\n".utf8)) else {
                if complete { connection.cancel() }
                else { respond(on: connection, operation: operation, buffered: request) }
                return
            }
            let lines = String(decoding: request[..<headerEnd.lowerBound], as: UTF8.self).components(separatedBy: "\r\n")
            let parts = lines[0].split(separator: " ")
            let fields = lines.dropFirst().map { $0.lowercased() }
            let contentLength = fields.first { $0.hasPrefix("content-length: ") }.flatMap { Int($0.dropFirst(16)) } ?? 0
            let payload = request[headerEnd.upperBound...]
            if payload.count < contentLength {
                if complete { connection.cancel() }
                else { respond(on: connection, operation: operation, buffered: request) }
                return
            }
            let status: String
            let body: String
            if parts.count == 3, parts[0] == "POST", fields.contains("authorization: bearer fixture"),
               let target = URLComponents(string: String(parts[1])) {
                if target.path == "/api/mobile/v1/ebook-upload-grants",
                   let grant = try? JSONDecoder().decode(GrantRequest.self, from: payload),
                   grant.size == 15_000_000, grant.kind == operation.rawValue, grant.requestId == "large-book",
                   grant.targetId == (operation == .upload ? "library" : "book") {
                    status = "200 OK"
                    body = #"{"id":"fixture-grant","upload":null}"#
                } else if target.path == operation.path,
                          target.queryItems?.contains(.init(name: "uploadId", value: "fixture-grant")) == true,
                          !fields.contains(where: { $0.hasPrefix("content-type:") || $0.hasPrefix("transfer-encoding:") }),
                          fields.allSatisfy({ !$0.hasPrefix("content-length:") || $0 == "content-length: 0" }),
                          payload.isEmpty {
                    status = "200 OK"
                    body = #"{"id":"book","libraryId":"library","title":"Book","topics":[],"emoji":null,"createdAt":null,"format":"ebook"}"#
                } else {
                    status = "400 Bad Request"
                    body = #"{"error":{"code":"invalid_input","message":"Expected bodyless ebook finalization","retryable":false}}"#
                }
            } else {
                status = "400 Bad Request"
                body = #"{"error":{"code":"invalid_input","message":"Expected authenticated POST","retryable":false}}"#
            }
            let response = "HTTP/1.1 \(status)\r\nContent-Type: application/json\r\nContent-Length: \(body.utf8.count)\r\nConnection: close\r\n\r\n" + body
            connection.send(content: Data(response.utf8), completion: .contentProcessed { _ in connection.cancel() })
        }
    }
}
