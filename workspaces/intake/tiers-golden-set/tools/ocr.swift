// swift ocr.swift <image> ... -> prints recognized text lines per image (macOS Vision)
import Foundation
import Vision
import AppKit
for path in CommandLine.arguments.dropFirst() {
  guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("ERR \(path)"); continue }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.usesLanguageCorrection = true
  let h = VNImageRequestHandler(cgImage: cg, options: [:])
  try? h.perform([req])
  print("=== \(path)")
  for o in (req.results ?? []) { if let c = o.topCandidates(1).first { print(c.string) } }
}
