# Measurement Architecture

Physical and Spatial metrology requirements.

## Logical Declarations
- **Declared Quantity**: Extracting the written text (e.g., "500g").
- **Actual Quantity**: Must be physically verified (e.g., 498g on a scale).

## Missing / Future Hardware Capabilities
Camera-only inspection *cannot* prove:
- **Calibrated Scale Weight**
- **Internal Volume**
- **Internal Count**

Camera inspection *can* prove:
- **Font/Spatial Measurement**: Pixel area mapping to mm (requires reference scale in frame).
- **Rule 13 Area Declarations**: Determining if the Principal Display Panel text size meets the minimum mm/height requirement.

## Workflow Integration
- **Batch Sampling**: LMPC dictates statistical sampling protocols (e.g., 32 samples per batch). 
- **Maximum Permissible Error (MPE)**: The threshold tolerance permitted between actual vs declared quantity, integrated into the deterministic rule engine.
