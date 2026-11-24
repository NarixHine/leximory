import Foundation

public enum EbookFileLimit {
    public static let standardBytes = 4_718_592
    public static let subscriberBytes = 15_000_000
}

struct EbookResumableUpload: Sendable {
    let endpoint: URL
    let token: String
    let publicKey: String
    let bucket: String
    let path: String

    private static let chunkSize = 6 * 1024 * 1024
    private static let session = URLSession(configuration: .ephemeral, delegate: NoRedirects(), delegateQueue: nil)

    private final class NoRedirects: NSObject, URLSessionTaskDelegate {
        func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                        newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
            completionHandler(nil)
        }
    }

    func upload(_ data: Data, filename: String, send: @Sendable (URLRequest) async throws -> HTTPURLResponse = sendRequest) async throws {
        guard endpoint.scheme == "https", endpoint.host != nil, endpoint.user == nil, endpoint.password == nil else {
            throw URLError(.unsupportedURL)
        }
        var create = request("POST", at: endpoint)
        create.setValue(String(data.count), forHTTPHeaderField: "Upload-Length")
        let fields = [
            ("bucketName", bucket), ("objectName", path), ("cacheControl", "0"),
            ("contentType", (filename as NSString).pathExtension.lowercased() == "pdf" ? "application/pdf" : "application/epub+zip"),
        ]
        create.setValue(fields.map { "\($0.0) \(Data($0.1.utf8).base64EncodedString())" }.joined(separator: ","),
                        forHTTPHeaderField: "Upload-Metadata")
        let createRequest = create
        let location = try await MutationRetry.run {
            let response = try await send(createRequest)
            try validate(response, expected: 201)
            guard let header = response.value(forHTTPHeaderField: "Location"),
                  let url = URL(string: header, relativeTo: endpoint)?.absoluteURL,
                  url.scheme == endpoint.scheme, url.host == endpoint.host, url.port == endpoint.port,
                  url.user == nil, url.password == nil, url.path.hasPrefix(endpoint.path + "/") else {
                throw URLError(.cannotParseResponse)
            }
            return url
        }

        var offset = 0
        while offset < data.count {
            let start = offset
            let end = min(start + Self.chunkSize, data.count)
            offset = try await MutationRetry.run {
                do {
                    var patch = request("PATCH", at: location)
                    patch.setValue("application/offset+octet-stream", forHTTPHeaderField: "Content-Type")
                    patch.setValue(String(start), forHTTPHeaderField: "Upload-Offset")
                    patch.httpBody = data.subdata(in: start..<end)
                    let response = try await send(patch)
                    try validate(response, expected: 204)
                    guard uploadOffset(response) == end else { throw URLError(.cannotParseResponse) }
                    return end
                } catch {
                    guard MutationRetry.isRetryable(error) else { throw error }
                    let response = try await send(request("HEAD", at: location))
                    try validate(response, expected: 200, alternative: 204)
                    guard let received = uploadOffset(response), received >= start, received <= end else {
                        throw URLError(.cannotParseResponse)
                    }
                    guard received > start else { throw error }
                    return received
                }
            }
        }
    }

    private func request(_ method: String, at url: URL) -> URLRequest {
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData)
        request.httpMethod = method
        request.setValue("1.0.0", forHTTPHeaderField: "Tus-Resumable")
        request.setValue(token, forHTTPHeaderField: "x-signature")
        request.setValue(publicKey, forHTTPHeaderField: "apikey")
        return request
    }

    private func uploadOffset(_ response: HTTPURLResponse) -> Int? {
        response.value(forHTTPHeaderField: "Upload-Offset").flatMap(Int.init)
    }

    private func validate(_ response: HTTPURLResponse, expected: Int, alternative: Int? = nil) throws {
        let status = response.statusCode
        if status == expected || status == alternative { return }
        if status == 413 { throw URLError(.dataLengthExceedsMaximum) }
        if [408, 409, 412, 423, 429].contains(status) || status >= 500 { throw URLError(.badServerResponse) }
        throw URLError(.resourceUnavailable)
    }

    private static func sendRequest(_ request: URLRequest) async throws -> HTTPURLResponse {
        let (_, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        return response
    }
}
