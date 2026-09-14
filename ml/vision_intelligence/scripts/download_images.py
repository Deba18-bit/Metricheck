import json
import urllib.request
import os
from pathlib import Path

def download_images():
    base_dir = Path(__file__).parent.parent
    manifest_path = base_dir / "dataset" / "raw" / "off_india_manifest.json"
    raw_dir = base_dir / "dataset" / "raw"
    
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
        
    print(f"Downloading first 20 images to {raw_dir}...")
    
    for i, item in enumerate(manifest[:20]):
        img_url = item["image_urls"]["front"]
        if img_url:
            filename = f"img_{i+1:03d}.jpg"
            out_path = raw_dir / filename
            try:
                urllib.request.urlretrieve(img_url, out_path)
                print(f"Downloaded {filename}")
            except Exception as e:
                print(f"Failed to download {img_url}: {e}")

if __name__ == "__main__":
    download_images()
