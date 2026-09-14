import os
import sys
import json
import time
import glob
from pathlib import Path
from PIL import Image
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted
from pydantic import ValidationError

sys.path.append(str(Path(__file__).parent.parent))
from src.schema import ImageAnnotations, Annotation, ProductContext

def auto_annotate():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found in environment.")
        sys.exit(1)
        
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        "gemini-3.6-flash",
        generation_config={"response_mime_type": "application/json"}
    )
    
    base_dir = Path(__file__).parent.parent
    raw_dir = base_dir / "dataset" / "raw"
    ann_dir = base_dir / "dataset" / "annotations"
    ann_dir.mkdir(parents=True, exist_ok=True)
    
    images = sorted(glob.glob(str(raw_dir / "img_*.jpg")))
    
    prompt_both = """
You are a Legal Metrology packaging inspector. First, classify the product context. Then, find the bounding boxes for the declaration classes.
Return a SINGLE JSON object with this exact structure:
{
  "product_context": {
    "product_category": "A broad category (e.g. FOOD, ELECTRONICS, COSMETICS)",
    "product_subcategory": "A specific subcategory (e.g. BISCUITS, BEVERAGES, SPICES, DAIRY, SNACKS, SWEETS)",
    "imported_status": "Must be exactly 'DOMESTIC', 'IMPORTED', or 'UNKNOWN'",
    "confidence": 0.95
  },
  "annotations": [
    {
      "field": "Must be one of: MRP, NET_QUANTITY, MANUFACTURER_PACKER_IMPORTER, CONSUMER_CARE, MANUFACTURE_PACKING_DATE, COUNTRY_OF_ORIGIN, PRODUCT_COMMON_NAME, BEST_BEFORE_USE_BY, UNIT_SALE_PRICE",
      "bbox": [ymin, xmin, ymax, xmax] (normalized to 0-1000 scale, where 0 is top/left and 1000 is bottom/right),
      "ocr_text": "The exact text visible"
    }
  ]
}
"""

    prompt_context_only = """
You are a Legal Metrology packaging inspector. Classify the product context.
Return a SINGLE JSON object with this exact structure:
{
  "product_context": {
    "product_category": "A broad category (e.g. FOOD, ELECTRONICS, COSMETICS)",
    "product_subcategory": "A specific subcategory (e.g. BISCUITS, BEVERAGES, SPICES, DAIRY, SNACKS, SWEETS)",
    "imported_status": "Must be exactly 'DOMESTIC', 'IMPORTED', or 'UNKNOWN'",
    "confidence": 0.95
  }
}
"""

    for img_path in images:
        img_name = Path(img_path).name
        out_path = ann_dir / img_name.replace(".jpg", ".json")
        
        needs_context = True
        needs_annotations = True
        existing_ann = None
        
        if out_path.exists():
            with open(out_path, "r") as f:
                data = json.load(f)
                existing_ann = ImageAnnotations(**data)
            
            if existing_ann.product_context is not None:
                needs_context = False
            needs_annotations = False
            
        if not needs_context and not needs_annotations:
            print(f"Skipping {img_name}, already fully annotated.")
            continue
            
        print(f"Processing {img_name}...")
        success = False
        retries = 0
        
        while not success and retries < 3:
            try:
                with Image.open(img_path) as img:
                    width, height = img.size
                    
                    if not needs_annotations and needs_context:
                        # Only ask for context
                        response = model.generate_content([img, prompt_context_only])
                        raw_data = json.loads(response.text)
                        if "product_context" in raw_data:
                            existing_ann.product_context = ProductContext(**raw_data["product_context"])
                        with open(out_path, "w") as f:
                            json.dump(existing_ann.model_dump(mode='json', exclude_none=True), f, indent=2)
                        print(f"  -> Added Product Context to {img_name}")
                        
                    else:
                        # Ask for both
                        response = model.generate_content([img, prompt_both])
                        raw_data = json.loads(response.text)
                        
                        annotations = []
                        product_context = None
                        
                        if isinstance(raw_data, dict):
                            if "product_context" in raw_data:
                                product_context = ProductContext(**raw_data["product_context"])
                            raw_annotations = raw_data.get("annotations", [])
                        else:
                            raw_annotations = raw_data if isinstance(raw_data, list) else []
                            
                        for item in raw_annotations:
                            if not isinstance(item, dict) or "bbox" not in item:
                                continue
                            
                            ymin, xmin, ymax, xmax = item["bbox"]
                            
                            abs_xmin = (xmin / 1000.0) * width
                            abs_ymin = (ymin / 1000.0) * height
                            abs_xmax = (xmax / 1000.0) * width
                            abs_ymax = (ymax / 1000.0) * height
                            
                            abs_xmin = max(0, min(abs_xmin, width))
                            abs_ymin = max(0, min(abs_ymin, height))
                            abs_xmax = max(0, min(abs_xmax, width))
                            abs_ymax = max(0, min(abs_ymax, height))
                            
                            if abs_xmin >= abs_xmax:
                                abs_xmax = min(abs_xmin + 1.0, width)
                                if abs_xmin >= abs_xmax: abs_xmin = max(0, abs_xmax - 1.0)
                            
                            if abs_ymin >= abs_ymax:
                                abs_ymax = min(abs_ymin + 1.0, height)
                                if abs_ymin >= abs_ymax: abs_ymin = max(0, abs_ymax - 1.0)
                            
                            try:
                                ann = Annotation(
                                    field=item.get("field"),
                                    bbox=[abs_xmin, abs_ymin, abs_xmax, abs_ymax],
                                    ocr_text=item.get("ocr_text"),
                                    source="gemini-3.6-flash"
                                )
                                annotations.append(ann)
                            except ValidationError:
                                continue
                        
                        img_ann = ImageAnnotations(
                            image_id=img_name,
                            width=width,
                            height=height,
                            product_context=product_context,
                            annotations=annotations
                        )
                        
                        with open(out_path, "w") as f:
                            json.dump(img_ann.model_dump(mode='json', exclude_none=True), f, indent=2)
                            
                        print(f"  -> Saved {len(annotations)} annotations and Product Context for {img_name}")
                        
                    success = True
                    time.sleep(15)
                    
            except ResourceExhausted as e:
                print(f"Rate limit hit. Sleeping for 60 seconds...")
                time.sleep(60)
                retries += 1
            except Exception as e:
                print(f"Error processing {img_name}: {e}")
                break

if __name__ == "__main__":
    auto_annotate()
