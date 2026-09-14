import json
import glob
from collections import Counter

files = glob.glob("ml/vision_intelligence/dataset/annotations/*.json")
class_counts = Counter()
categories = Counter()
subcategories = Counter()
imported_status = Counter()

for fpath in files:
    with open(fpath, "r") as f:
        data = json.load(f)
        
    pc = data.get("product_context", {})
    categories[pc.get("product_category", "MISSING")] += 1
    subcategories[pc.get("product_subcategory", "MISSING")] += 1
    imported_status[pc.get("imported_status", "MISSING")] += 1
    
    for ann in data.get("annotations", []):
        class_counts[ann["field"]] += 1

print(f"Total processed: {len(files)}")
print("\nProduct Categories:")
for k, v in categories.items(): print(f"  - {k}: {v}")
print("\nProduct Subcategories:")
for k, v in subcategories.items(): print(f"  - {k}: {v}")
print("\nImported Status:")
for k, v in imported_status.items(): print(f"  - {k}: {v}")
print("\nDeclaration Annotations:")
for k, v in class_counts.items(): print(f"  - {k}: {v}")

