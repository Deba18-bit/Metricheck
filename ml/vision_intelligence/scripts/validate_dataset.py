import os
import sys
import json
from pathlib import Path

# Add src to Python path
sys.path.append(str(Path(__file__).parent.parent))
from src.schema import ImageAnnotations

def validate_directory(annotations_dir: str):
    path = Path(annotations_dir)
    if not path.exists() or not path.is_dir():
        print(f"Directory {annotations_dir} does not exist.")
        return False

    json_files = list(path.glob("*.json"))
    if not json_files:
        print(f"No JSON files found in {annotations_dir}.")
        return True # Not an error, just empty

    all_valid = True
    for json_file in json_files:
        try:
            with open(json_file, "r") as f:
                data = json.load(f)
            
            # Pydantic validation
            ImageAnnotations(**data)
            print(f"✓ {json_file.name}: Valid")
        except Exception as e:
            all_valid = False
            print(f"✗ {json_file.name}: Invalid")
            print(f"  {str(e)}")

    return all_valid

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Validate dataset annotations.")
    parser.add_argument("--dir", type=str, default="dataset/annotations", help="Directory containing JSON annotations")
    args = parser.parse_args()
    
    # Resolve relative to the ml/vision_intelligence folder
    base_dir = Path(__file__).parent.parent
    target_dir = base_dir / args.dir

    is_valid = validate_directory(str(target_dir))
    sys.exit(0 if is_valid else 1)
