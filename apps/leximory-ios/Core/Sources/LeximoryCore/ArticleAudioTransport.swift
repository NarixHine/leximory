import Foundation
import HTTPTypes
import OpenAPIRuntime
import OpenAPIURLSession

struct ArticleAudioTransport: ClientTransport {
    private let standard = URLSessionTransport()
    private let generation: URLSessionTransport
    init() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 600
        configuration.timeoutIntervalForResource = 600
        generation = URLSessionTransport(configuration: .init(session: URLSession(configuration: configuration)))
    }
    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        let transport = operationID == "generateArticleAudio" ? generation : standard
        return try await transport.send(request, body: body, baseURL: baseURL, operationID: operationID)
    }
}
