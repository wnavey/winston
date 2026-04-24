
import sys, json
from PIL import Image
bbox = json.loads(sys.argv[1])
img = Image.open(sys.argv[2])
w, h = img.size
crop_box = (int(bbox["x0"]*w), int(bbox["y0"]*h), int(bbox["x1"]*w), int(bbox["y1"]*h))
img.crop(crop_box).save(sys.argv[3], "JPEG", quality=90)
