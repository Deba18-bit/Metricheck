import json
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

# Load classes dynamically or define statically. 
# For strictness and speed, let's load them from the config at runtime.
CONFIG_PATH = Path(__file__).parent.parent / "configs" / "classes.json"
try:
    with open(CONFIG_PATH, "r") as f:
        VALID_CLASSES = set(json.load(f)["classes"])
except FileNotFoundError:
    VALID_CLASSES = set()

class Annotation(BaseModel):
    field: str
    bbox: List[float] = Field(..., min_length=4, max_length=4, description="[xmin, ymin, xmax, ymax]")
    ocr_text: Optional[str] = None
    verified_text: Optional[str] = None
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    source: Optional[str] = None
    evidence_quality: Optional[str] = None
    verification_status: Optional[str] = None

    @field_validator("field")
    def validate_field(cls, v):
        if VALID_CLASSES and v not in VALID_CLASSES:
            raise ValueError(f"Invalid field class: {v}. Must be one of {VALID_CLASSES}")
        return v

    @field_validator("bbox")
    def validate_bbox_coords(cls, v):
        xmin, ymin, xmax, ymax = v
        if xmin >= xmax:
            raise ValueError("xmin must be less than xmax")
        if ymin >= ymax:
            raise ValueError("ymin must be less than ymax")
        return v

class ProductContext(BaseModel):
    product_category: Optional[str] = None
    product_subcategory: Optional[str] = None
    imported_status: Optional[str] = Field(None, pattern="^(DOMESTIC|IMPORTED|UNKNOWN)$")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)

class ImageAnnotations(BaseModel):
    image_id: str
    width: Optional[int] = Field(None, gt=0)
    height: Optional[int] = Field(None, gt=0)
    product_context: Optional[ProductContext] = None
    annotations: List[Annotation] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_bboxes_against_image_dims(self):
        w, h = self.width, self.height
        if w is not None and h is not None:
            for i, ann in enumerate(self.annotations):
                xmin, ymin, xmax, ymax = ann.bbox
                if xmin < 0 or ymin < 0 or xmax > w or ymax > h:
                    raise ValueError(f"Annotation {i} bbox {ann.bbox} is out of image bounds ({w}x{h})")
        return self

    @model_validator(mode="after")
    def validate_duplicates(self):
        # A simple check for duplicate exact bboxes and fields for the same image
        seen = set()
        for ann in self.annotations:
            identifier = (ann.field, tuple(ann.bbox))
            if identifier in seen:
                raise ValueError(f"Duplicate annotation found for field '{ann.field}' at {ann.bbox}")
            seen.add(identifier)
        return self
