import Foundation

public enum MutationRetry {
    public static let maxAttempts = 3

    public static func isRetryable(_ error: any Error) -> Bool {
        let cause = MobileClient.cause(of: error)
        if let failure = cause as? MobileFailure { return failure.error.retryable }
        if MobileClient.isConnectionFailure(error) { return true }
        guard let error = cause as? URLError else { return false }
        return [.badServerResponse, .cannotParseResponse].contains(error.code)
    }
    public static func pause(after attempt: Int) async throws {
        try await Task.sleep(for: .milliseconds(attempt == 0 ? 300 : 900))
    }
    public static func run<Value: Sendable>(
        operation: @Sendable () async throws -> Value,
        pause: @Sendable (Int) async throws -> Void = MutationRetry.pause
    ) async throws -> Value {
        for attempt in 0..<maxAttempts {
            do { return try await operation() }
            catch {
                guard attempt + 1 < maxAttempts, isRetryable(error) else { throw error }
                try await pause(attempt)
            }
        }
        throw URLError(.unknown)
    }
}
