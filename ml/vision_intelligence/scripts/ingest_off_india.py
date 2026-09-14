import os
import sys
import json
import time
import requests
from pathlib import Path
from collections import defaultdict

def ingest_dataset():
    url = "https://in.openfoodfacts.org/api/v2/search"
    
    target_per_category = 30
    cat_keywords = {
        "Snacks": ["snack", "biscuit", "chip", "crisp", "cookie", "namkeen"],
        "Beverages": ["beverage", "drink", "juice", "tea", "coffee", "water"],
        "Spices": ["spice", "masala", "herb", "seasoning", "salt", "sauce", "pickle"],
        "Sweets": ["sweet", "chocolate", "candy", "confectionery", "dessert"],
        "Dairy": ["dairy", "milk", "cheese", "butter", "paneer", "yogurt", "ghee"]
    }

    def assign_category(categories_str):
        if not categories_str:
            return "Other"
        categories_str = categories_str.lower()
        for cat, keywords in cat_keywords.items():
            if any(kw in categories_str for kw in keywords):
                return cat
        return "Other"

    headers = {
        "User-Agent": "METRICHECK-Vision-Intelligence/1.0 (Research)"
    }

    manifest = []
    seen_barcodes = set()
    category_counts = defaultdict(int)

    # If manifest exists, load it to resume
    base_dir = Path(__file__).parent.parent
    dataset_dir = base_dir / "dataset" / "raw"
    dataset_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = dataset_dir / "off_india_manifest.json"
    
    if manifest_path.exists():
        with open(manifest_path, "r") as f:
            manifest = json.load(f)
        for item in manifest:
            seen_barcodes.add(item["barcode"])
            category_counts[item["category"]] += 1

    page = (len(manifest) // 50) + 1
    total_target = 150
    
    print(f"Resuming Open Food Facts India dataset ingestion. Current items: {len(manifest)}/150")

    while len(manifest) < total_target:
        params = {
            "countries_tags_en": "india",
            "fields": "code,product_name,brands,categories,image_front_url,image_ingredients_url,image_nutrition_url",
            "sort_by": "unique_scans_n",
            "page_size": 50, # smaller page size might help avoid 503
            "page": page
        }
        
        print(f"Fetching page {page}...")
        try:
            response = requests.get(url, params=params, headers=headers, timeout=20)
            if response.status_code == 503 or response.status_code == 429:
                print("Rate limited or service unavailable. Sleeping for 15 seconds...")
                time.sleep(15)
                continue
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            print(f"Error fetching data: {e}")
            print("Sleeping for 15 seconds...")
            time.sleep(15)
            continue
            
        products = data.get("products", [])
        if not products:
            print("No more products found on this page. Might be the end.")
            break

        for p in products:
            if len(manifest) >= total_target:
                break
                
            code = p.get("code")
            if not code or code in seen_barcodes:
                continue

            img_front = p.get("image_front_url")
            if not img_front:
                continue

            categories_str = p.get("categories", "")
            broad_cat = assign_category(categories_str)
            
            if category_counts[broad_cat] >= target_per_category and broad_cat != "Other":
                if category_counts["Other"] >= target_per_category:
                    continue
                else:
                    broad_cat = "Other"
            elif broad_cat == "Other" and category_counts["Other"] >= target_per_category:
                continue

            item = {
                "barcode": code,
                "product_name": p.get("product_name", "Unknown"),
                "brand": p.get("brands", "Unknown"),
                "category": broad_cat,
                "original_categories": categories_str,
                "source_url": f"https://in.openfoodfacts.org/product/{code}",
                "image_urls": {
                    "front": img_front,
                    "ingredients": p.get("image_ingredients_url"),
                    "nutrition": p.get("image_nutrition_url"),
                },
                "license": "Open Database License (ODbL)",
                "source": "Open Food Facts"
            }

            manifest.append(item)
            seen_barcodes.add(code)
            category_counts[broad_cat] += 1
            
        print(f"Current manifest size: {len(manifest)}/150")
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)
            
        page += 1
        time.sleep(2) # be gentle

    print(f"\nSuccessfully created reproducible manifest with {len(manifest)} items at:")
    print(str(manifest_path))
    print("\nCategory Distribution:")
    for cat, count in category_counts.items():
        print(f"- {cat}: {count}")

if __name__ == "__main__":
    ingest_dataset()
