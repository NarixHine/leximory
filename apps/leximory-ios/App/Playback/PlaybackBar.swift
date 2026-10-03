import SwiftUI

struct PlaybackBar: View {
    let playback: PlaybackController
    var body: some View {
        VStack(spacing: 8) {
            switch playback.state {
            case .idle: EmptyView()
            case .loading:
                HStack { ProgressView(); Text("正在加载录音……").font(LeximoryTypography.interface(15, style: .subheadline)); Spacer(); close }
            case .unavailable:
                HStack { Label("录音暂不可用", systemImage: "speaker.slash").font(LeximoryTypography.interface(15, style: .subheadline)); Spacer(); close }
            case .failed(_, let message):
                HStack { Text(message).font(LeximoryTypography.interface(15, style: .subheadline)); Spacer(); close }
            case .ready(let source, let elapsed, let duration, let playing):
                HStack(spacing: 16) {
                    Button(playing ? "暂停" : "播放", systemImage: playing ? "pause.fill" : "play.fill") {
                        if playing { playback.pause() } else { playback.resume() }
                    }.labelStyle(.iconOnly).font(.title3).frame(minWidth: 44, minHeight: 44)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(source.title).font(LeximoryTypography.interface(15, style: .subheadline)).lineLimit(1)
                        Text(source.audioID == "fixture_recording" ? "测试音频（示例录音）" : "文章录音").font(LeximoryTypography.interface(12, style: .caption1)).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(Duration.seconds(elapsed).formatted(.time(pattern: .minuteSecond)))
                        .font(LeximoryTypography.interface(12, style: .caption1).monospacedDigit()).foregroundStyle(.secondary)
                    close
                }
                if duration > 0 {
                    Slider(value: Binding(get: { elapsed }, set: { playback.seek(to: $0) }), in: 0...duration)
                        .accessibilityLabel("播放进度")
                }
            }
        }
        .padding(.horizontal, 20).padding(.vertical, 10).background(.bar)
        .accessibilityIdentifier("playback-bar")
    }
    private var close: some View {
        Button("停止播放", systemImage: "xmark") { playback.stop() }
            .labelStyle(.iconOnly).frame(minWidth: 44, minHeight: 44)
    }
}
