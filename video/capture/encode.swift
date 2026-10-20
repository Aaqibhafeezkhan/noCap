// Encodes timestamped screencast JPEGs into a constant-frame-rate H.264 MP4.
// usage: swift capture/encode.swift <framesDir> <frames.json> <out.mp4>
import AVFoundation
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers

struct Frame: Decodable { let file: String; let t: Double }

let args = CommandLine.arguments
let dir = URL(fileURLWithPath: args[1])
let frames = try JSONDecoder().decode([Frame].self, from: Data(contentsOf: URL(fileURLWithPath: args[2])))
let mp4URL = URL(fileURLWithPath: args[3])

func image(_ name: String) -> CGImage {
    let src = CGImageSourceCreateWithURL(dir.appendingPathComponent(name) as CFURL, nil)!
    return CGImageSourceCreateImageAtIndex(src, 0, nil)!
}

/// Frame shown at time `t` (seconds from start): the last screencast frame at or before t.
func frameIndex(at t: Double, start: Double, from hint: Int) -> Int {
    var i = hint
    while i + 1 < frames.count && frames[i + 1].t - start <= t { i += 1 }
    return i
}

let start = frames[0].t
let duration = frames.last!.t - start + 0.5 // hold the last frame briefly
let first = image(frames[0].file)
let width = first.width, height = first.height

// MP4 -------------------------------------------------------------------------
try? FileManager.default.removeItem(at: mp4URL)
let writer = try AVAssetWriter(outputURL: mp4URL, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width, AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 24_000_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height,
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)
let ctx = CIContext()
let fps = 30.0
var hint = 0
var lastIndex = -1
var lastBuffer: CVPixelBuffer?
for n in 0..<Int(duration * fps) {
    let t = Double(n) / fps
    hint = frameIndex(at: t, start: start, from: hint)
    if hint != lastIndex {
        var buffer: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &buffer)
        ctx.render(CIImage(cgImage: image(frames[hint].file)), to: buffer!)
        lastBuffer = buffer
        lastIndex = hint
    }
    while !input.isReadyForMoreMediaData { usleep(2000) }
    adaptor.append(lastBuffer!, withPresentationTime: CMTime(value: CMTimeValue(n), timescale: CMTimeScale(fps)))
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print("mp4:", writer.status == .completed ? "ok" : "failed \(String(describing: writer.error))")
