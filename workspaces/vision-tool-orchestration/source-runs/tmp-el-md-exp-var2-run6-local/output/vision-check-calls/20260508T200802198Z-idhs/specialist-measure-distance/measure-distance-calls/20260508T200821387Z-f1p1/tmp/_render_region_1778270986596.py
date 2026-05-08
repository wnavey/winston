
import sys, json
import fitz  # PyMuPDF

bbox = json.loads(sys.argv[1])
pdf_path = sys.argv[2]
out_path = sys.argv[3]
dpi = int(sys.argv[4])

doc = fitz.open(pdf_path)
page = doc[0]
rect = page.rect

# Convert normalized 0-1 bbox to PDF points
clip = fitz.Rect(
    rect.x0 + bbox["x0"] * rect.width,
    rect.y0 + bbox["y0"] * rect.height,
    rect.x0 + bbox["x1"] * rect.width,
    rect.y0 + bbox["y1"] * rect.height,
)

pix = page.get_pixmap(dpi=dpi, clip=clip)
# Save as JPEG via PIL for quality control
from PIL import Image
img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
img.save(out_path, "JPEG", quality=92)
print(json.dumps({"width": pix.width, "height": pix.height}))
