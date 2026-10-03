@preconcurrency import AVFoundation

/// Serializes audio-session calls away from the UI executor. Monotonic request
/// generations prevent an older stop from deactivating a newer reader's audio.
actor AudioSessionCoordinator {
    private var latestGeneration = 0
    private var active = false
    func activate(generation: Int) throws {
        guard generation >= latestGeneration else { throw CancellationError() }
        latestGeneration = generation
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .spokenAudio)
        try session.setActive(true)
        active = true
    }
    func deactivate(generation: Int) {
        guard generation >= latestGeneration else { return }
        latestGeneration = generation
        guard active else { return }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        active = false
    }
}
