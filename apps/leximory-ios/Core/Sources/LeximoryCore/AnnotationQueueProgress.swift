public func annotationQueueProgressLabel(readyCount: Int, pendingCount: Int) -> String? {
    if pendingCount > 0 { return "\(readyCount)/\(readyCount + pendingCount)" }
    if readyCount > 0 { return "\(readyCount)" }
    return nil
}
