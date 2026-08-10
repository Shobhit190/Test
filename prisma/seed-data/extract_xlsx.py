import pandas as pd
import json
import os
import sys

# Usage: python3 extract_xlsx.py <Competency_Mapping_*.xlsx>
# Regenerates role-competency-map.json from the source Excel file.
SRC = sys.argv[1] if len(sys.argv) > 1 else "Competency_Mapping_for_Founders_4.xlsx"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "role-competency-map.json")

df = pd.read_excel(SRC, sheet_name="Sheet1", header=None)

comp_col_names = [df.iloc[1, c].strip() for c in range(2, 21)]
# these must line up 1:1 (by name, case/spacing-insensitive) with the 19 dictionary competencies
NAME_FIX = {
    "Strategic Thinking & foresight": "Strategic Thinking & Foresight",
    "Influencial Communication": "Influential Communication",
    "Dealing with ambiguity/ Peace with chaos": "Ambiguity Navigation",
    "Bridge Builder Mindset, (Negotiation SkillsInter-personal, Collaboration)": "Bridge-Builder Mindset",
    "Result Orientation (Bias For Action)": "Result Orientation (Bias for Action)",
    "Problem solving": "Problem Solving",
    "Student first integrity": "Student/Education-First Integrity",
    "Attention to Details": "Attention to Detail",
    " Data Analysis": "Data Analysis",
    "Openness to learnings": "Openness to Learnings",
    "Tech -Ed foresight": "Tech-Ed Foresight",
}
canonical_names = [NAME_FIX.get(n, n) for n in comp_col_names]

roles = []
for r in range(2, df.shape[0]):
    role_name_raw = df.iloc[r, 1]
    if pd.isna(role_name_raw):
        continue
    # Cell text is a single designation title; it sometimes embeds the business
    # unit(s) it applies to as trailing text (e.g. "Business Head,Vedam, Mirai, ALTA, Stride")
    # rather than being several distinct designations, so it is kept intact as one row.
    role_name = " ".join(str(role_name_raw).replace("\n", " ").split()).strip().rstrip(",")
    required = []
    for c in range(2, 21):
        val = df.iloc[r, c]
        if pd.notna(val) and float(val) == 1:
            required.append(canonical_names[c - 2])
    notes_val = df.iloc[r, 22] if df.shape[1] > 22 else None
    notes = str(notes_val).strip() if pd.notna(notes_val) else None
    roles.append({"designation": role_name, "requiredCompetencies": required, "notes": notes})

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    json.dump({"competencyColumns": canonical_names, "roles": roles}, f, indent=2, ensure_ascii=False)

print("wrote", OUT)
print(len(roles), "role rows")
for r in roles[:5]:
    print(r["designation"], "->", len(r["requiredCompetencies"]), "competencies")
