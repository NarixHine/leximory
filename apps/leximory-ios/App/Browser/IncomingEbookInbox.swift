import Foundation
import Observation

@MainActor @Observable
final class IncomingEbookInbox {
    private struct Request {
        let id = UUID()
        var result: Result<BrowserEbookFile, Error>?
    }
    private var requests: [Request] = []

    var nextID: UUID? {
        guard let first = requests.first, first.result != nil else { return nil }
        return first.id
    }

    @discardableResult
    func receive(_ url: URL) -> Task<Void, Never>? {
        guard url.isFileURL else { return nil }
        let request = Request()
        requests.append(request)
        return Task {
            let result: Result<BrowserEbookFile, Error>
            do { result = .success(try await BrowserEbookFile.read(url)) }
            catch { result = .failure(error) }
            guard let index = requests.firstIndex(where: { $0.id == request.id }) else { return }
            requests[index].result = result
        }
    }

    func takeNext() -> Result<BrowserEbookFile, Error>? {
        guard let result = requests.first?.result else { return nil }
        requests.removeFirst()
        return result
    }
}
