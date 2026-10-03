import SwiftUI

struct PlaybackBar: View {
    let playback: PlaybackController
    var body: some View {
        VStack(spacing: 8) {
            switch playback.state {
            case .idle: EmptyView()
            case .loading:
                HStack { ProgressView(); Text("Opening recording…").font(.subheadline); Spacer(); close }
            case .unavailable:
                HStack { Label("Recording unavailable", systemImage: "speaker.slash").font(.subheadline); Spacer(); close }
            case .failed(_, let message):
                HStack { Text(message).font(.subheadline); Spacer(); close }
            case .ready(let source, let elapsed, let duration, let playing):
                HStack(spacing: 16) {
                    Button(playing ? "Pause" : "Play", systemImage: playing ? "pause.fill" : "play.fill") {
                        if playing { playback.pause() } else { playback.resume() }
                    }.labelStyle(.iconOnly).font(.title3).frame(minWidth: 44, minHeight: 44)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(source.title).font(.subheadline).lineLimit(1)
                        Text("Diagnostic tone · Fixture audio").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(Duration.seconds(elapsed).formatted(.time(pattern: .minuteSecond)))
                        .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                    close
                }
                if duration > 0 {
                    Slider(value: Binding(get: { elapsed }, set: { playback.seek(to: $0) }), in: 0...duration)
                        .accessibilityLabel("Playback position")
                }
            }
        }
        .padding(.horizontal, 20).padding(.vertical, 10).background(.bar)
        .accessibilityIdentifier("playback-bar")
    }
    private var close: some View {
        Button("Stop playback", systemImage: "xmark") { playback.stop() }
            .labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44)
    }
}
