import Foundation
import Testing
@testable import LeximoryCore

struct EbookResumableUploadTests {
    @Test func resumesAtTheCommittedOffsetAfterLosingAResponse() async throws {
        let endpoint = try #require(URL(string: "https://fixture.storage.supabase.co/storage/v1/upload/resumable/sign"))
        let server = ResumableUploadFixture(endpoint: endpoint)
        let upload = EbookResumableUpload(endpoint: endpoint, token: "fixture-token", publicKey: "fixture-publishable", bucket: "private-uploads", path: "draft.pdf")
        let data = Data(repeating: 7, count: 15_000_000)
        try await upload.upload(data, filename: "Book.pdf") { request in try await server.send(request) }
        #expect(await server.methods == ["POST", "PATCH", "HEAD", "PATCH", "PATCH"])
        #expect(await server.offsets == [0, 6_291_456, 12_582_912])
        #expect(await server.bytes == data)
    }

    @Test func refusesToForwardTheSignatureToAnotherHost() async throws {
        let endpoint = try #require(URL(string: "https://fixture.storage.supabase.co/storage/v1/upload/resumable/sign"))
        let upload = EbookResumableUpload(endpoint: endpoint, token: "fixture-token", publicKey: "fixture-publishable", bucket: "private-uploads", path: "draft.pdf")
        await #expect(throws: URLError(.cannotParseResponse)) {
            try await upload.upload(Data([1]), filename: "Book.pdf") { request in
                #expect(request.url == endpoint)
                #expect(request.httpMethod == "POST")
                return try #require(HTTPURLResponse(url: endpoint, statusCode: 201, httpVersion: nil,
                    headerFields: ["Location": "https://different.example/storage/v1/upload/resumable/sign/upload"]))
            }
        }
    }
}

private actor ResumableUploadFixture {
    let endpoint: URL
    private(set) var methods: [String] = []
    private(set) var offsets: [Int] = []
    private(set) var bytes = Data()

    init(endpoint: URL) { self.endpoint = endpoint }

    func send(_ request: URLRequest) throws -> HTTPURLResponse {
        let method = try #require(request.httpMethod)
        let url = try #require(request.url)
        methods.append(method)
        #expect(request.value(forHTTPHeaderField: "Tus-Resumable") == "1.0.0")
        #expect(request.value(forHTTPHeaderField: "x-signature") == "fixture-token")
        #expect(request.value(forHTTPHeaderField: "apikey") == "fixture-publishable")
        let location = endpoint.appending(path: "upload")
        switch method {
        case "POST":
            #expect(url == endpoint)
            #expect(request.value(forHTTPHeaderField: "Upload-Length") == "15000000")
            #expect(request.value(forHTTPHeaderField: "Upload-Metadata")?.contains("contentType YXBwbGljYXRpb24vcGRm") == true)
            return try response(url, status: 201, fields: ["Location": location.path])
        case "HEAD":
            #expect(url == location)
            return try response(url, status: 200, fields: ["Upload-Offset": String(bytes.count)])
        case "PATCH":
            #expect(url == location)
            let offset = try #require(request.value(forHTTPHeaderField: "Upload-Offset").flatMap(Int.init))
            #expect(offset == bytes.count)
            offsets.append(offset)
            bytes.append(try #require(request.httpBody))
            if offset == 0 { throw URLError(.networkConnectionLost) }
            return try response(url, status: 204, fields: ["Upload-Offset": String(bytes.count)])
        default:
            Issue.record("Unexpected upload method")
            throw URLError(.badServerResponse)
        }
    }

    private func response(_ url: URL, status: Int, fields: [String: String]) throws -> HTTPURLResponse {
        try #require(HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: fields))
    }
}
