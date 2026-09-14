# Legal Technology Matrix

Mapping the Legal Metrology (Packaged Commodities) Rules, 2011 to technology implementation.

| Rule / Requirement | Applicability | Observable Evidence | Tech Requirement | Implementation Status | Confidence State |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Rule 6(1)(a)** - Name & Address | All packages | Manufacturer/Packer/Importer text | OCR + NLP mapping | Active (Regex/Gemini) | Fallback to Manual |
| **Rule 6(1)(b)** - Common/Generic Name | All packages | Product common name | OCR + Product Intelligence | Active | Partial (Needs UI tuning) |
| **Rule 6(1)(c)** - Net Quantity | All packages | Weight/Vol/Count string | OCR + Unit Parsing | Active | High |
| **Rule 6(1)(d)** - Month & Year of Mfg | All packages | Date string (Mfg/Pkd) | Date Parser | Active | High |
| **Rule 6(1)(e)** - MRP | All retail packages | ₹, Rs, MRP string | OCR Regex | Active | High |
| **Rule 6(1)(g)** - Consumer Care | All packages | Phone, Email, Address | Contact Regex | Active | High |
| **Rule 9(3)** - Principal Display Panel | All packages | Grouping of declarations | YOLO Spatial Bbox | Missing / Future | - |
| **Rule 13(5)** - Font Size/Area | Specific Area | Box dimensions vs Text | Spatial Measurement | Missing / Future | - |

*Note: Matrix relies on currently implemented rules in the `rulesData.js` and FastAPI backend engine.*
