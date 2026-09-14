import pytest
import sys
from pathlib import Path
from pydantic import ValidationError

sys.path.append(str(Path(__file__).parent.parent))
from src.schema import Annotation, ImageAnnotations

def test_valid_annotation():
    ann = Annotation(
        field="MRP",
        bbox=[10, 10, 100, 100],
        confidence=0.9
    )
    assert ann.field == "MRP"

def test_invalid_class():
    with pytest.raises(ValidationError):
        Annotation(field="INVALID_CLASS", bbox=[10, 10, 100, 100])

def test_invalid_bbox_coords():
    # xmin > xmax
    with pytest.raises(ValidationError):
        Annotation(field="MRP", bbox=[100, 10, 10, 100])
    
    # ymin > ymax
    with pytest.raises(ValidationError):
        Annotation(field="MRP", bbox=[10, 100, 100, 10])

def test_bbox_out_of_bounds():
    data = {
        "image_id": "test1.jpg",
        "width": 100,
        "height": 100,
        "annotations": [
            {
                "field": "MRP",
                "bbox": [10, 10, 150, 50] # xmax > width
            }
        ]
    }
    with pytest.raises(ValidationError, match="out of image bounds"):
        ImageAnnotations(**data)

def test_duplicate_annotations():
    data = {
        "image_id": "test2.jpg",
        "annotations": [
            {
                "field": "MRP",
                "bbox": [10, 10, 50, 50]
            },
            {
                "field": "MRP",
                "bbox": [10, 10, 50, 50]
            }
        ]
    }
    with pytest.raises(ValidationError, match="Duplicate annotation found"):
        ImageAnnotations(**data)

def test_valid_image_annotations():
    data = {
        "image_id": "test3.jpg",
        "width": 1920,
        "height": 1080,
        "annotations": [
            {
                "field": "MRP",
                "bbox": [100, 100, 200, 200],
                "confidence": 0.95
            }
        ]
    }
    img_ann = ImageAnnotations(**data)
    assert len(img_ann.annotations) == 1
