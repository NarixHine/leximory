import SwiftUI
import UIKit

struct PlaybackBar: View {
    let playback: PlaybackController
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var scrubPosition: Double?

    var body: some View {
        HStack(spacing: 12) {
            switch playback.state {
            case .idle: EmptyView()
            case .loading:
                HStack(spacing: 10) { ProgressView(); Text("正在加载录音").interfaceFont(14) }
                    .frame(maxWidth: .infinity)
            case .unavailable:
                Label("录音暂不可用", systemImage: "speaker.slash")
                    .interfaceFont(14).frame(maxWidth: .infinity)
            case .failed(_, let message):
                Text(message).interfaceFont(14)
                    .frame(maxWidth: .infinity)
            case .ready(_, let elapsed, let duration, let playing):
                Button {
                    if playing { playback.pause() } else { playback.resume() }
                } label: {
                    Image(systemName: playing ? "pause.fill" : "play.fill")
                        .font(.system(size: 20, weight: .medium))
                        .contentTransition(reduceMotion ? .identity : .symbolEffect(.replace))
                        .frame(width: 44, height: 44).contentShape(Circle())
                }.accessibilityLabel(playing ? "暂停" : "播放")
                timeline(elapsed: elapsed, duration: duration)
            }
            Button { playback.stop() } label: {
                Image(systemName: "xmark").font(.system(size: 14, weight: .medium))
                    .frame(width: 44, height: 44).contentShape(Circle())
            }.accessibilityLabel("停止播放")
        }
        .buttonStyle(.plain).foregroundStyle(LeximoryPalette.ink).tint(LeximoryPalette.ink)
        .padding(12)
        .frame(maxWidth: 420)
        .glassEffect(.regular, in: .rect(cornerRadius: 28))
        .accessibilityIdentifier("playback-bar")
        .onChange(of: playback.state.source) { scrubPosition = nil }
        .onChange(of: scenePhase) { scrubPosition = nil }
        .onDisappear { scrubPosition = nil }
    }

    private func timeline(elapsed: Double, duration: Double) -> some View {
        let position = min(scrubPosition ?? elapsed, duration)
        let elapsedTime = time(position)
        let totalTime = duration > 0 ? time(duration) : "--:--"
        return VStack(spacing: -12) {
            PlaybackSlider(elapsed: elapsed, duration: duration, preview: $scrubPosition, seek: playback.seek)
                .frame(height: 44)
            HStack {
                Text(elapsedTime)
                Spacer(minLength: 8)
                Text(totalTime)
            }
            .interfaceFont(12).monospacedDigit()
            .foregroundStyle(LeximoryPalette.muted)
            .accessibilityHidden(true)
        }
    }

    private func time(_ seconds: Double) -> String {
        Duration.seconds(seconds).formatted(.time(pattern: .minuteSecond))
    }
}

private struct PlaybackSlider: UIViewRepresentable {
    let elapsed: Double
    let duration: Double
    @Binding var preview: Double?
    let seek: (Double) -> Void

    func makeUIView(context: Context) -> Control {
        let control = Control(frame: .zero)
        control.minimumValue = 0
        control.tintColor = UIColor(LeximoryPalette.ink)
        control.accessibilityLabel = "播放进度"
        control.addTarget(control, action: #selector(Control.valueChanged), for: .valueChanged)
        control.setContentHuggingPriority(.defaultLow, for: .horizontal)
        return control
    }

    func updateUIView(_ control: Control, context: Context) {
        control.preview = { position in
            DispatchQueue.main.async { preview = position }
        }
        control.seek = seek
        let maximum = Float(max(duration, 1))
        if control.maximumValue != maximum { control.maximumValue = maximum }
        if control.isEnabled != (duration > 0) { control.isEnabled = duration > 0 }
        if !control.isTracking { control.value = Float(elapsed) }
        let position = Duration.seconds(Double(control.value)).formatted(.time(pattern: .minuteSecond))
        let total = duration > 0 ? Duration.seconds(duration).formatted(.time(pattern: .minuteSecond)) : "--:--"
        control.accessibilityValue = "已播放 \(position)，总时长 \(total)"
    }

    final class Control: UISlider {
        var preview: ((Double?) -> Void)?
        var seek: ((Double) -> Void)?

        @objc func valueChanged() {
            if isTracking { preview?(Double(value)) }
            else { seek?(Double(value)) }
        }

        override func endTracking(_ touch: UITouch?, with event: UIEvent?) {
            super.endTracking(touch, with: event)
            let position = Double(value)
            preview?(nil)
            seek?(position)
        }

        override func cancelTracking(with event: UIEvent?) {
            super.cancelTracking(with: event)
            preview?(nil)
        }
    }
}
