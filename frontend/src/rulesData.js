export const rulesData = [
  {
    rule_id: "LMPC-6-1-e",
    title: "Maximum Retail Price (MRP)",
    short_description: "The package should display the maximum retail price payable by the consumer.",
    system_check_description: "Detects standard MRP declaration formats and extracts the price value.",
    examples: ["MRP ₹150", "MRP: Rs. 150", "Maximum Retail Price ₹250"],
    legal_reference: "Legal Metrology (Packaged Commodities) Rules, 2011 - Rule 6(1)(e)",
    legal_text: "Every package shall bear thereon or on label securely affixed thereto, a definite, plain and conspicuous declaration as to the retail sale price of the package.",
    implementation_status: "implemented", // implemented, partial, coming_soon
    applicable_categories: ["all"]
  },
  {
    rule_id: "LMPC-6-1-c",
    title: "Net Quantity",
    short_description: "The package must declare the quantity of the commodity.",
    system_check_description: "Identifies weight, volume, or count declarations and their respective units.",
    examples: ["Net Qty: 500 g", "Net Weight: 1 kg", "Quantity: 250 ml"],
    legal_reference: "Legal Metrology (Packaged Commodities) Rules, 2011 - Rule 6(1)(c)",
    legal_text: "Every package shall bear thereon or on label securely affixed thereto, a definite, plain and conspicuous declaration as to the net quantity, in terms of the standard unit of weight or measure, of the commodity contained in the package or where the commodity is packed or sold by number, the number of the commodity contained in the package.",
    implementation_status: "implemented",
    applicable_categories: ["all"]
  },
  {
    rule_id: "LMPC-6-1-d",
    title: "Manufacturing / Packing Date",
    short_description: "Packages require relevant manufacturing or packing declarations.",
    system_check_description: "Extracts dates associated with manufacturing, packing, or importing. Ambiguous dates may flag for manual review.",
    examples: ["Mfg: 15 OCT 2023", "Packed: 12-Jan-24", "Mfd: 08/2026"],
    legal_reference: "Legal Metrology (Packaged Commodities) Rules, 2011 - Rule 6(1)(d)",
    legal_text: "Every package shall bear thereon or on label securely affixed thereto, a definite, plain and conspicuous declaration as to the month and year in which the commodity is manufactured or pre-packed or imported.",
    implementation_status: "implemented",
    applicable_categories: ["all"]
  },
  {
    rule_id: "LMPC-6-1-g",
    title: "Consumer Care Details",
    short_description: "Consumers should be provided appropriate contact information for complaints or queries.",
    system_check_description: "Searches for phone numbers, emails, or addresses explicitly labeled for consumer or customer care.",
    examples: ["Consumer Care: 1800-123-4567", "Customer Care: 9876543210", "CR Details: Call 1800-123-4567"],
    legal_reference: "Legal Metrology (Packaged Commodities) Rules, 2011 - Rule 6(1)(g)",
    legal_text: "Every package shall bear thereon or on label securely affixed thereto, a definite, plain and conspicuous declaration as to the name, address, telephone number, e-mail address, if available, of the person who can be or the office which can be, contacted, in case of consumer complaints.",
    implementation_status: "implemented",
    applicable_categories: ["all"]
  }
];

export const categoriesData = [
  {
    id: "food",
    title: "Food & Beverages",
    description: "Packaged food items, drinks, and consumables.",
    status: "partial", // implemented, partial, coming_soon
    implemented_rules: ["LMPC-6-1-e", "LMPC-6-1-c", "LMPC-6-1-d", "LMPC-6-1-g"],
    future_rules: ["FSSAI License Number", "Nutritional Information", "Ingredient List", "Vegetarian/Non-Vegetarian Logo"]
  },
  {
    id: "cosmetics",
    title: "Cosmetics & Personal Care",
    description: "Beauty products, skincare, and grooming items.",
    status: "coming_soon",
    implemented_rules: ["LMPC-6-1-e", "LMPC-6-1-c", "LMPC-6-1-g"],
    future_rules: ["Use Before Date", "Batch Number", "Ingredients Declaration"]
  },
  {
    id: "household",
    title: "Household Products",
    description: "Cleaning supplies, detergents, and general household items.",
    status: "coming_soon",
    implemented_rules: ["LMPC-6-1-e", "LMPC-6-1-c", "LMPC-6-1-d", "LMPC-6-1-g"],
    future_rules: ["Safety Warnings", "Usage Instructions"]
  },
  {
    id: "electronics",
    title: "Electrical / Electronic Products",
    description: "Appliances, gadgets, and accessories.",
    status: "coming_soon",
    implemented_rules: ["LMPC-6-1-e", "LMPC-6-1-d", "LMPC-6-1-g"],
    future_rules: ["BIS Certification Mark", "Voltage/Power Ratings", "E-waste Disposal Instructions"]
  },
  {
    id: "pharma",
    title: "Pharmaceutical / Health",
    description: "Over-the-counter medicines, supplements, and health devices.",
    status: "coming_soon",
    implemented_rules: ["LMPC-6-1-e", "LMPC-6-1-c", "LMPC-6-1-d"],
    future_rules: ["Expiry Date", "Schedule Warning", "Active Ingredients"]
  },
  {
    id: "general",
    title: "General Packaged Commodities",
    description: "Standard packaged goods not falling into specialized categories.",
    status: "partial",
    implemented_rules: ["LMPC-6-1-e", "LMPC-6-1-c", "LMPC-6-1-d", "LMPC-6-1-g"],
    future_rules: ["Country of Origin (for imported goods)", "Manufacturer Address Details"]
  }
];

export const officialRulesTable = [
  {
    rule: "Rule 3",
    title: "Application of the Chapter",
    description: "Explains which packages Chapter II applies to and identifies exclusions (e.g. large packages, industrial use).",
    status: "coming_soon",
    notes: "Before scanning, the system could eventually determine if this package is covered by our retail-package rule set using AI classification."
  },
  {
    rule: "Rule 4",
    title: "Regulation for pre-packing and sale",
    description: "Requires packages to carry the declarations required by the rules before being sold/distributed.",
    status: "partial",
    notes: "This is the overall principle behind our scanner. We don't create a separate Rule 4 card, but we enforce it through Rule 6 checks."
  },
  {
    rule: "Rule 5",
    title: "Specific commodities and standard package sizes",
    description: "Historically dealt with recommended/standard package sizes (amended/omitted in rule history).",
    status: "not_applicable",
    notes: "Not currently implementing this as a core check."
  },
  {
    rule: "Rule 6(1)(a)",
    title: "Manufacturer / Packer / Importer",
    description: "Identity and address details of the Manufacturer, Packer, or Importer.",
    status: "coming_soon",
    notes: "Future extraction: Manufactured by, Packed by, Imported by, Address."
  },
  {
    rule: "Rule 6(1)(aa)",
    title: "Country of Origin",
    description: "Relevant to imported products. Must declare Country of Origin or Manufacture.",
    status: "coming_soon",
    notes: "This rule should only be applied when the product is actually an imported product via future product classification."
  },
  {
    rule: "Rule 6(1)(b)",
    title: "Common or Generic Name of Commodity",
    description: "The package should identify what the commodity actually is.",
    status: "coming_soon",
    notes: "Directly related to future product identification AI."
  },
  {
    rule: "Rule 6(1)(c)",
    title: "Net Quantity",
    description: "Quantity, weight, volume, or number of pieces.",
    status: "implemented",
    notes: "We currently extract Quantity, Weight, Volume, Unit using OCR + Deterministic extraction + LLM fallback."
  },
  {
    rule: "Rule 6(1)(d)",
    title: "Manufacturing date",
    description: "Month and year of manufacture, packing, or import.",
    status: "implemented",
    notes: "Deterministic extraction of dates. LLM fallback helps interpret context if ambiguous."
  },
  {
    rule: "Rule 6(1)(e)",
    title: "Maximum Retail Price",
    description: "The MRP inclusive of all taxes.",
    status: "implemented",
    notes: "Regex extraction. If failed, selective LLM fallback."
  },
  {
    rule: "Rule 6(1)(f)",
    title: "Dimensions of commodities",
    description: "Where size is relevant, applicable dimensions must be declared.",
    status: "coming_soon",
    notes: "Likely relevant for fabric, sheets, furniture-related packaged commodities."
  },
  {
    rule: "Rule 6(1)(g)",
    title: "Consumer Care Details",
    description: "Phone and email-related information for consumer complaints.",
    status: "implemented",
    notes: "We check for Consumer Care, Customer Care, Phone, CR Details. Will expand to emails."
  },
  {
    rule: "Rule 7",
    title: "Principal Display Panel",
    description: "Display area and minimum size of letters/numerals for mandatory declarations.",
    status: "coming_soon",
    notes: "Could use Computer Vision + OCR bounding boxes + Package dimensions, but requires reliable scale/measurement."
  },
  {
    rule: "Rule 8",
    title: "Where declarations must appear",
    description: "Placement and surrounding space for quantity declarations.",
    status: "coming_soon",
    notes: "The system could inspect if required info is placed appropriately. This is much more difficult than simple text extraction."
  },
  {
    rule: "Rule 9",
    title: "Manner in which declarations are made",
    description: "Legibility, prominence, appropriate contrast, not obscured, language requirements.",
    status: "partial",
    notes: "We already have Image quality checks (Sharpness, Brightness, Readability). Needs full compliance engine."
  },
  {
    rule: "Rule 10",
    title: "Manufacturer details and address",
    description: "More detailed requirements for manufacturer/packer/importer name and address.",
    status: "coming_soon",
    notes: "Would require extracting Company name, Address, City, State, PIN code."
  },
  {
    rule: "Rule 11",
    title: "General provisions relating to quantity",
    description: "Deals with net quantity, excluding packaging, environmental variation.",
    status: "not_applicable",
    notes: "We only check if a quantity declaration exists. A package image cannot determine the actual physical quantity inside."
  },
  {
    rule: "Rule 12",
    title: "Manner of declaration of quantity",
    description: "Defines how quantity should be expressed (Mass, Length, Area, Volume, Number) depending on commodity.",
    status: "coming_soon",
    notes: "Connects with product classification to determine whether the declaration format is appropriate."
  },
  {
    rule: "Rule 13",
    title: "Statement of units",
    description: "Deals with appropriate units (e.g., Less than 1 kg → grams).",
    status: "coming_soon",
    notes: "Our extractor already recognizes units. Future validator will check if the unit is correctly declared."
  },
  {
    rule: "Rule 14",
    title: "Dimensions of certain commodities",
    description: "Relevant to bedsheets, fabric, sarees, towels, etc.",
    status: "coming_soon",
    notes: "Future category: Textiles."
  },
  {
    rule: "Rule 15",
    title: "Dimensions and weight where related to price",
    description: "Where dimensions/weight relate to price, declaration must be included.",
    status: "coming_soon",
    notes: "Requires advanced classification."
  },
  {
    rule: "Rule 16",
    title: "Number of usable sheets",
    description: "Applies to foil, tissues, toilet paper. Requires number of sheets + dimensions.",
    status: "coming_soon",
    notes: "Future category: Paper / household products."
  },
  {
    rule: "Rule 17",
    title: "Container-type commodities",
    description: "Deals with bags, boxes, cups, pans.",
    status: "coming_soon",
    notes: "Future category-specific rule."
  },
  {
    rule: "Rule 18",
    title: "Wholesale and retail dealer provisions",
    description: "Compliance obligations for selling/storing, including restrictions on selling above MRP.",
    status: "not_applicable",
    notes: "A package image cannot tell what price the shop actually charged."
  },
  {
    rule: "Rule 19",
    title: "Inspection and quantity testing at premises",
    description: "Official inspection and testing procedures using sampling and measurement.",
    status: "not_applicable",
    notes: "Would require physical samples, weighing, measurement, and sampling."
  },
  {
    rule: "Rule 20",
    title: "Action after inspection",
    description: "Actions following official inspection when violations are found.",
    status: "not_applicable",
    notes: "Our product can report a compliance issue, but should not pretend to have legal enforcement authority."
  },
  {
    rule: "Rule 21",
    title: "Inspection at wholesale/retail premises",
    description: "Inspection/testing in wholesale and retail contexts.",
    status: "not_applicable",
    notes: "Not directly applicable to our image scanner."
  },
  {
    rule: "Rule 22",
    title: "Maximum Permissible Error",
    description: "Defines maximum permissible quantity error.",
    status: "not_applicable",
    notes: "Not possible using only a package photograph. Needs physical weighing devices."
  },
  {
    rule: "Rule 23",
    title: "Deceptive packages",
    description: "Packages designed to give a misleading impression about quantity (e.g., misleading empty space).",
    status: "coming_soon",
    notes: "Very advanced future AI/CV possibility. Cannot be reliably decided from ordinary OCR alone."
  },
  {
    rule: "Rule 24",
    title: "Wholesale packages",
    description: "Declarations on wholesale packages.",
    status: "coming_soon",
    notes: "We could eventually add Package type: Retail vs Wholesale."
  },
  {
    rule: "Rule 25",
    title: "Export packages",
    description: "Export packages cannot be sold in India without compliance with domestic requirements.",
    status: "not_applicable",
    notes: "Not currently applicable."
  },
  {
    rule: "Rule 26",
    title: "Exemptions",
    description: "Certain packages may be exempt (e.g. very small packages).",
    status: "coming_soon",
    notes: "Important future feature. Product classification AI can help determine if a product/package is exempt."
  },
  {
    rule: "Rule 27-30",
    title: "Registration",
    description: "Registration of manufacturers, packers and importers.",
    status: "not_applicable",
    notes: "Possible future enterprise feature to cross-check registrations against an authoritative data source."
  },
  {
    rule: "Rule 31",
    title: "Advertisements",
    description: "Advertisements mentioning retail price must also declare net quantity/number.",
    status: "coming_soon",
    notes: "Potential future mode: Advertisement Scanner."
  },
  {
    rule: "Rule 32",
    title: "Fine for contravention",
    description: "Penalties where no specific punishment is otherwise provided.",
    status: "not_applicable",
    notes: "We do not calculate penalties. Future AI explanation feature can explain what rule appears to be involved without pretending to be a court."
  }
];
