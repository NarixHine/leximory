import SwiftUI

struct PlaybackBar: View {
    let playback: PlaybackController
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var scrubPosition: Double?

    var body: some View {
        HStack(spacing: 6) {
            switch playback.state {
            case .idle: EmptyView()
            case .loading:
                HStack(spacing: 10) { ProgressView(); Text("正在加载录音").font(LeximoryTypography.interface(14)) }
                    .frame(maxWidth: .infinity)
            case .unavailable:
                Label("录音暂不可用", systemImage: "speaker.slash")
                    .font(LeximoryTypography.interface(14)).frame(maxWidth: .infinity)
            case .failed(_, let message):
                Text(message).font(LeximoryTypography.interface(14))
                    .frame(maxWidth: .infinity)
            case .ready(let source, let elapsed, let duration, let playing):
                Button {
                    if playing { playback.pause() } else { playback.resume() }
                } label: {
                    Image(systemName: playing ? "pause.fill" : "play.fill")
                        .font(.system(size: 18, weight: .medium))
                        .contentTransition(reduceMotion ? .identity : .symbolEffect(.replace))
                        .frame(width: 44, height: 44).contentShape(Circle())
                }.accessibilityLabel(playing ? "暂停" : "播放")
                VStack(spacing: 0) {
                    HStack(spacing: 8) {
                        Text(source.title).font(LeximoryTypography.interface(13))
                            .lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                        Text(Duration.seconds(scrubPosition ?? elapsed).formatted(.time(pattern: .minuteSecond)))
                            .font(LeximoryTypography.interface(11).monospacedDigit())
                            .foregroundStyle(LeximoryPalette.muted)
                            .accessibilityLabel("已播放时间")
                    }
                    if duration > 0 {
                        Slider(value: Binding(get: { scrubPosition ?? elapsed }, set: { scrubPosition = $0 }), in: 0...duration) { editing in
                            if !editing, let position = scrubPosition {
                                playback.seek(to: position); scrubPosition = nil
                            }
                        }.controlSize(.mini).accessibilityLabel("播放进度")
                    }
                }
            }
            Button { playback.stop() } label: {
                Image(systemName: "xmark").font(.system(size: 13, weight: .medium))
                    .frame(width: 44, height: 44).contentShape(Circle())
            }.accessibilityLabel("停止播放")
        }
        .buttonStyle(.plain).foregroundStyle(LeximoryPalette.ink).tint(LeximoryPalette.ink)
        .padding(.horizontal, 8).padding(.vertical, 8)
        .frame(maxWidth: 420)
        .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 32, style: .continuous))
        .accessibilityIdentifier("playback-bar")
    }
}
