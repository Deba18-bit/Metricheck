import json
import requests
from collections import Counter
import concurrent.futures

manifest_path = "ml/vision_intelligence/dataset/raw/off_india_manifest.json"

with open(manifest_path, "r") as f:
    data = json.load(f)

total_products = len(data)
front_count = 0
ingredients_count = 0
nutrition_count = 0
missing_name = 0
missing_brand = 0

barcodes = []
categories = []
all_front_urls = []

for item in data:
    barcodes.append(item.get("barcode"))
    categories.append(item.get("category"))
    
    name = item.get("product_name")
    if not name or name == "Unknown":
        missing_name += 1
        
    brand = item.get("brand")
    if not brand or brand == "Unknown":
        missing_brand += 1
        
    urls = item.get("image_urls", {})
    if urls.get("front"):
        front_count += 1
        all_front_urls.append(urls.get("front"))
    if urls.get("ingredients"):
        ingredients_count += 1
    if urls.get("nutrition"):
        nutrition_count += 1

barcode_counts = Counter(barcodes)
duplicates = sum(1 for v in barcode_counts.values() if v > 1)
cat_counts = Counter(categories)

# Check reachability of front URLs using a thread pool
reachable = 0
unreachable = 0

def check_url(url):
    try:
        r = requests.head(url, timeout=5, headers={"User-Agent": "METRICHECK"})
        # Some CDNs reject HEAD, fallback to GET with stream
        if r.status_code in [403, 404, 405]:
            r = requests.get(url, stream=True, timeout=5, headers={"User-Agent": "METRICHECK"})
            r.close()
        return r.status_code == 200
    except:
        return False

print(f"Total Products: {total_products}")
print(f"Front Images: {front_count}")
print(f"Ingredients Images: {ingredients_count}")
print(f"Nutrition Images: {nutrition_count}")
print(f"Duplicate Barcodes: {duplicates}")
print(f"Missing/Unknown Names: {missing_name}")
print(f"Missing/Unknown Brands: {missing_brand}")
print("Category Counts:")
for k, v in cat_counts.items():
    print(f"  - {k}: {v}")

print("Checking URL reachability (front images)...")
with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
    results = list(executor.map(check_url, all_front_urls))
    
reachable = sum(1 for r in results if r)
unreachable = len(results) - reachable

print(f"Front URLs Reachable: {reachable}")
print(f"Front URLs Unreachable: {unreachable}")

