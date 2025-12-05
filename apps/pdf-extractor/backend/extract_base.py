import argparse
import os
import json
from pathlib import Path
from .llm import LLMClient

def load_schema(schema_path: Path) -> str:
    with open(schema_path, "r") as f:
        return f.read()

def load_prompt(prompt_path: Path) -> str:
    with open(prompt_path, "r") as f:
        return f.read()

def extract_base(pdf_path: Path, output_dir: Path, provider: str = "gemini", model: str = "gemini-3-pro-preview"):
    root_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
    # Adjust root_dir if needed based on where this script is relative to root
    # This script is in apps/pdf-extractor/backend/extract_base.py
    # So parent x 4 is apps/pdf-extractor
    # parent x 5 is dc-product-agent-v3 (root)
    
    # Actually, let's rely on relative paths from the script location
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent.parent # dc-product-agent-v3
    
    prompt_path = project_root / "docs" / "prompts" / "base_extraction_prompt.md"
    schema_dir = project_root / "reference" / "schema"
    
    # Load Schemas
    # The user mentioned: common-defs.described.schema.json and base-technical-bulletin-llm.schema.json
    # But checking the file list earlier, I saw base-technical-bulletin-with-defs.described.schema.json
    # I'll use the one I saw earlier or try to find the LLM specific one.
    # If LLM specific one is not found, I'll use the main one.
    
    schema_files = [
        "common-defs.described.schema.json",
        "base-technical-bulletin-llm.schema.json" 
    ]
    
    schemas_text = ""
    for schema_file in schema_files:
        s_path = schema_dir / schema_file
        if s_path.exists():
            schemas_text += f"\n\n--- {schema_file} ---\n{load_schema(s_path)}"
        else:
            print(f"Warning: Schema file {schema_file} not found at {s_path}")

    # Load Prompt Template
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    
    base_prompt = load_prompt(prompt_path)
    
    # Construct Final Prompt
    # We append the schemas to the prompt
    full_prompt = f"{base_prompt}\n\n# Schemas\n{schemas_text}"
    
    # Initialize LLM
    llm = LLMClient(provider=provider, model=model)
    
    print(f"Extracting from {pdf_path.name} using {provider}...")
    
    # Call LLM
    response_text = llm.call(full_prompt, images=[pdf_path])
    
    # Clean up response (remove markdown code blocks if present)
    if response_text.startswith("```yaml"):
        response_text = response_text.replace("```yaml", "").replace("```", "")
    elif response_text.startswith("```"):
        response_text = response_text.replace("```", "")
        
    # Save to Output
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"{pdf_path.stem}_base.yaml"
    
    with open(output_file, "w") as f:
        f.write(response_text)
        
    print(f"Saved extraction to {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract base info from PDF")
    parser.add_argument("pdf_path", type=Path, help="Path to PDF file")
    parser.add_argument("--output-dir", type=Path, default=Path("data/extracts/base_extraction_yaml"), help="Output directory")
    parser.add_argument("--provider", default="gemini", help="LLM Provider")
    parser.add_argument("--model", default="gemini-3-pro-preview", help="Model name")
    
    args = parser.parse_args()
    extract_base(args.pdf_path, args.output_dir, args.provider, args.model)
