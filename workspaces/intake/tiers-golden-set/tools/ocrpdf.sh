#!/bin/zsh
# ocrpdf.sh <in.pdf> <out.txt>  -- rasterize at 200dpi into a temp dir next to out, OCR with macOS Vision
S=${0:A:h}
T=$(mktemp -d "${2:h}/ocrtmp.XXXX")
pdftoppm -r 200 -png "$1" "$T/p"
"$S/ocr" "$T"/p*.png > "$2"
rm -rf "$T"
wc -c "$2"
