// swift .artwork/og/spin-qr.swift PATH writes and checks the public Spin QR.
import AppKit
import CoreImage.CIFilterBuiltins
import Vision

let address = "https://spin.loftwah.com/"
let target = URL(fileURLWithPath: CommandLine.arguments[1])
let filter = CIFilter.qrCodeGenerator()
filter.message = Data(address.utf8)
filter.correctionLevel = "M"
let code = filter.outputImage!
let bounds = code.extent.insetBy(dx: -4, dy: -4)
let background = CIImage(color: .white).cropped(to: bounds)
let normalized = code.composited(over: background)
    .transformed(by: CGAffineTransform(translationX: -bounds.minX, y: -bounds.minY))
let scaled = normalized.transformed(by: CGAffineTransform(scaleX: 16, y: 16))
let image = CIContext().createCGImage(scaled, from: scaled.extent)!
let data = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])!
try data.write(to: target)

let request = VNDetectBarcodesRequest()
request.symbologies = [.qr]
try VNImageRequestHandler(url: target).perform([request])
guard request.results?.first?.payloadStringValue == address else {
    fatalError("Spin QR did not decode to the public URL")
}
print(address)
