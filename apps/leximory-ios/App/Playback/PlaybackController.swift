import Foundation
import Observation
@preconcurrency import AVFoundation
@preconcurrency import MediaPlayer
import LeximoryCore

struct PlaybackSource: Equatable, Sendable {
    let textID: TextID
    let audioID: String
    let title: String
}
struct PlaybackDescriptor: Sendable {
    let url: URL
    let expiresAt: Date
}
enum PlaybackState: Equatable {
    case idle
    case loading(PlaybackSource)
    case ready(PlaybackSource, elapsed: Double, duration: Double, playing: Bool)
    case unavailable(PlaybackSource)
    case failed(PlaybackSource, String)
    var source: PlaybackSource? {
        switch self {
        case .idle: nil
        case .loading(let source), .unavailable(let source), .failed(let source, _), .ready(let source, _, _, _): source
        }
    }
}

@MainActor @Observable final class PlaybackController {
    private(set) var state: PlaybackState = .idle
    var textID: TextID? { state.source?.textID }
    @ObservationIgnored private let resolve: @Sendable (PlaybackSource) async throws -> PlaybackDescriptor?
    @ObservationIgnored private let now: @Sendable () -> Date
    @ObservationIgnored private let audioSession = AudioSessionCoordinator()
    @ObservationIgnored private var player: AVPlayer?
    @ObservationIgnored private var descriptor: PlaybackDescriptor?
    @ObservationIgnored private var task: Task<Void, Never>?
    @ObservationIgnored private var timeObserver: Any?
    @ObservationIgnored private var statusObserver: NSKeyValueObservation?
    @ObservationIgnored private var notifications: [NSObjectProtocol] = []
    @ObservationIgnored private var commands: [(MPRemoteCommand, Any)] = []
    @ObservationIgnored private var generation = 0
    @ObservationIgnored private var wantsPlayback = false
    @ObservationIgnored private var interrupted = false

    init(resolve: @escaping @Sendable (PlaybackSource) async throws -> PlaybackDescriptor? = PlaybackController.fixtureDescriptor,
         now: @escaping @Sendable () -> Date = Date.init) {
        self.resolve = resolve; self.now = now
    }
    nonisolated static func fixtureDescriptor(_ source: PlaybackSource) async throws -> PlaybackDescriptor? {
        guard source.audioID == "fixture_recording",
              let url = Bundle.main.url(forResource: "diagnostic-tone", withExtension: "wav") else { return nil }
        return PlaybackDescriptor(url: url, expiresAt: Date().addingTimeInterval(3600))
    }
    func toggle(textID: TextID, audioID: String, title: String) {
        let source = PlaybackSource(textID: textID, audioID: audioID, title: title)
        if state.source == source, player != nil {
            if wantsPlayback { pause() } else { resume() }
            return
        }
        start(source)
    }
    private func start(_ source: PlaybackSource, seekTo: Double = 0, autoPlay: Bool = true) {
        stop()
        generation += 1
        let request = generation
        wantsPlayback = autoPlay
        state = .loading(source)
        task = Task { [weak self, resolve] in
            do {
                let descriptor = try await resolve(source)
                guard let self, !Task.isCancelled, self.generation == request else { return }
                guard let descriptor, descriptor.expiresAt > self.now() else {
                    self.wantsPlayback = false; self.state = .unavailable(source); return
                }
                try await self.audioSession.activate(generation: request)
                guard !Task.isCancelled, self.generation == request else {
                    await self.audioSession.deactivate(generation: request)
                    return
                }
                self.descriptor = descriptor
                let player = AVPlayer(url: descriptor.url)
                self.player = player
                self.installObservers(player: player, source: source, generation: request, seekTo: seekTo)
                self.installRemoteCommands()
            } catch {
                guard let self, !Task.isCancelled, self.generation == request else { return }
                self.wantsPlayback = false
                self.state = .failed(source, "无法播放录音，请重新打开。")
            }
        }
    }
    func waitForResolution() async { await task?.value }
    func pause() {
        wantsPlayback = false
        player?.pause()
        publishProgress()
    }
    func resume() {
        guard let source = state.source else { return }
        if let descriptor, descriptor.expiresAt <= now() {
            start(source, seekTo: player?.currentTime().seconds ?? 0)
            return
        }
        guard !interrupted else { wantsPlayback = true; return }
        wantsPlayback = true
        let request = generation
        task = Task { [weak self] in
            guard let self else { return }
            do {
                try await self.audioSession.activate(generation: request)
                guard self.generation == request, self.wantsPlayback, !self.interrupted else { return }
                let duration = self.player?.currentItem?.duration.seconds ?? 0
                if duration.isFinite, duration > 0, (self.player?.currentTime().seconds ?? 0) >= duration {
                    await self.player?.seek(to: .zero)
                }
                self.player?.play(); self.publishProgress()
            } catch {
                guard self.generation == request else { return }
                self.wantsPlayback = false; self.state = .failed(source, "音频输出暂不可用。")
            }
        }
    }
    func seek(to seconds: Double) {
        guard seconds.isFinite, let source = state.source, let player else { return }
        if let descriptor, descriptor.expiresAt <= now() { start(source, seekTo: max(0, seconds), autoPlay: wantsPlayback); return }
        let duration = player.currentItem?.duration.seconds ?? 0
        guard duration.isFinite, duration > 0 else { return }
        player.seek(to: CMTime(seconds: min(max(0, seconds), duration), preferredTimescale: 600))
        publishProgress()
    }
    func leaveReader(unless textID: TextID?) {
        if state.source?.textID != textID { stop() }
    }
    func stop() {
        generation += 1
        task?.cancel(); task = nil
        wantsPlayback = false; interrupted = false
        player?.pause()
        if let timeObserver { player?.removeTimeObserver(timeObserver) }
        timeObserver = nil; statusObserver = nil
        for notification in notifications { NotificationCenter.default.removeObserver(notification) }
        notifications.removeAll()
        for (command, target) in commands { command.removeTarget(target) }
        commands.removeAll()
        player = nil; descriptor = nil
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        let stoppedGeneration = generation
        Task { [audioSession] in await audioSession.deactivate(generation: stoppedGeneration) }
        state = .idle
    }
    private func installObservers(player: AVPlayer, source: PlaybackSource, generation request: Int, seekTo: Double) {
        statusObserver = player.currentItem?.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
            let status = item.status
            Task { @MainActor [weak self] in
                guard let self, self.generation == request else { return }
                switch status {
                case .readyToPlay:
                    if seekTo > 0 { self.seek(to: seekTo) }
                    if self.wantsPlayback && !self.interrupted { self.player?.play() }
                    self.publishProgress()
                case .failed:
                    self.wantsPlayback = false
                    self.state = .failed(source, "录音不存在或播放链接已过期。")
                    self.clearNowPlaying()
                default: break
                }
            }
        }
        timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.5, preferredTimescale: 600), queue: .main) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, self.generation == request else { return }
                self.publishProgress()
            }
        }
        notifications.append(NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: player.currentItem, queue: .main) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, self.generation == request else { return }
                self.wantsPlayback = false; self.player?.pause(); self.publishProgress()
            }
        })
        notifications.append(NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] event in
            let type = (event.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt).flatMap(AVAudioSession.InterruptionType.init(rawValue:))
            let options = event.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            Task { @MainActor [weak self] in
                guard let self, self.generation == request else { return }
                if type == .began { self.interrupted = true; self.player?.pause(); self.publishProgress() }
                if type == .ended {
                    self.interrupted = false
                    if self.wantsPlayback && AVAudioSession.InterruptionOptions(rawValue: options).contains(.shouldResume) { self.resume() }
                    else { self.pause() }
                }
            }
        })
        notifications.append(NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] event in
            let reason = event.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
            Task { @MainActor [weak self] in
                guard let self, self.generation == request else { return }
                if reason == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue { self.pause() }
            }
        })
    }
    private func installRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        commands.append((center.playCommand, center.playCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in self?.resume() }; return .success
        }))
        commands.append((center.pauseCommand, center.pauseCommand.addTarget { [weak self] _ in
            Task { @MainActor [weak self] in self?.pause() }; return .success
        }))
        commands.append((center.changePlaybackPositionCommand, center.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            let position = event.positionTime
            Task { @MainActor [weak self] in self?.seek(to: position) }; return .success
        }))
    }
    private func clearNowPlaying() { MPNowPlayingInfoCenter.default().nowPlayingInfo = nil }
    private func publishProgress() {
        guard let source = state.source, let player, player.currentItem?.status == .readyToPlay else { return }
        let rawDuration = player.currentItem?.duration.seconds ?? 0
        let duration = rawDuration.isFinite ? max(0, rawDuration) : 0
        let rawElapsed = player.currentTime().seconds
        let elapsed = rawElapsed.isFinite ? min(max(0, rawElapsed), duration) : 0
        let playing = player.rate > 0
        state = .ready(source, elapsed: elapsed, duration: duration, playing: playing)
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: source.title,
            MPMediaItemPropertyPlaybackDuration: duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: elapsed,
            MPNowPlayingInfoPropertyPlaybackRate: playing ? 1.0 : 0.0
        ]
    }
}
