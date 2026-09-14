import os
import sys
import glob
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def visualize():
    base_dir = Path(__file__).parent.parent
    raw_dir = base_dir / "dataset" / "raw"
    ann_dir = base_dir / "dataset" / "annotations"
    vis_dir = base_dir / "dataset" / "visualized"
    vis_dir.mkdir(parents=True, exist_ok=True)
    
    images = sorted(glob.glob(str(raw_dir / "img_*.jpg")))
    
    # Try to load a font, otherwise fallback to default
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except IOError:
        font = ImageFont.load_default()
        
    for img_path in images:
        img_name = Path(img_path).name
        json_path = ann_dir / img_name.replace(".jpg", ".json")
        out_path = vis_dir / img_name
        
        if not json_path.exists():
            continue
            
        with open(json_path, "r") as f:
            data = json.load(f)
            
        with Image.open(img_path) as img:
            draw = ImageDraw.Draw(img)
            
            # Draw header for product context
            context = data.get("product_context")
            if context:
                cat = context.get("product_category", "UNKNOWN")
                subcat = context.get("product_subcategory", "UNKNOWN")
                imp = context.get("imported_status", "UNKNOWN")
                conf = context.get("confidence", 0.0)
                header_text = f"Context: {cat} > {subcat} | {imp} | Conf: {conf}"
                
                # Draw a rectangle for background
                draw.rectangle([(0, 0), (img.width, 25)], fill=(0, 0, 0, 180))
                draw.text((5, 5), header_text, fill="white", font=font)
                
            for ann in data.get("annotations", []):
                bbox = ann["bbox"] # [xmin, ymin, xmax, ymax]
                field = ann["field"]
                ocr = ann.get("ocr_text", "")
                
                # Draw bounding box
                draw.rectangle([(bbox[0], bbox[1]), (bbox[2], bbox[3])], outline="red", width=2)
                
                # Draw label background and text
                label = f"{field}: {ocr}"
                # Get text size (rough approx for default font if truetype fails)
                try:
                    text_bbox = font.getbbox(label)
                    tw = text_bbox[2] - text_bbox[0]
                    th = text_bbox[3] - text_bbox[1]
                except AttributeError:
                    tw = len(label) * 6
                    th = 10
                
                draw.rectangle([(bbox[0], max(0, bbox[1] - th - 4)), 
                                (bbox[0] + tw + 4, max(0, bbox[1]))], 
                               fill="red")
                draw.text((bbox[0] + 2, max(0, bbox[1] - th - 2)), label, fill="white", font=font)
                
            img.save(out_path)
            print(f"Saved visualization: {out_path}")

if __name__ == "__main__":
    visualize()
