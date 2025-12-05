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

def extract_derived(base_json_path: Path, output_dir: Path, provider: str = "gemini", model: str = "gemini-3-pro-preview"):
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent.parent # dc-product-agent-v3
    
    prompt_path = project_root / "docs" / "prompts" / "derived_info_prompt.md"
    schema_dir = project_root / "reference" / "schema"
    
    schema_files = [
        "derived-info-with-knowledge-graph-with-defs.described.schema.json",
        "kg-entity.schema.json",
        "kg-triple.schema.json"
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
    
    derived_prompt = load_prompt(prompt_path)
    
    # Load Base JSON
    with open(base_json_path, "r") as f:
        base_data = json.load(f)
        # Convert to string for prompt
        base_json_str = json.dumps(base_data, indent=2)
    
    # Construct Final Prompt
    # We append the schemas and the base JSON to the prompt
    full_prompt = f"{derived_prompt}\n\n# Schemas\n{schemas_text}\n\n# Base Extraction Data\n```json\n{base_json_str}\n```"
    
    # Initialize LLM
    llm = LLMClient(provider=provider, model=model)
    
    print(f"Extracting derived info from {base_json_path.name} using {provider}...")
    
    # Call LLM
    # Note: No images needed here, just text
    response_text = llm.call(full_prompt)
    
    # Clean up response
    if response_text.startswith("```yaml"):
        response_text = response_text.replace("```yaml", "").replace("```", "")
    elif response_text.startswith("```"):
        response_text = response_text.replace("```", "")
        
    # Save to Output
    output_dir.mkdir(parents=True, exist_ok=True)
    # Filename convention: {stem}_derived.yaml
    # base_json_path is {stem}_base.json
    stem = base_json_path.stem.replace("_base", "")
    output_file = output_dir / f"{stem}_derived.yaml"
    
    with open(output_file, "w") as f:
        f.write(response_text)
        
    print(f"Saved derived extraction to {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract derived info from Base JSON")
    parser.add_argument("base_json_path", type=Path, help="Path to Base JSON file")
    parser.add_argument("--output-dir", type=Path, default=Path("data/extracts/derived_info_yaml"), help="Output directory")
    parser.add_argument("--provider", default="gemini", help="LLM Provider")
    parser.add_argument("--model", default="gemini-3-pro-preview", help="Model name")
    
    args = parser.parse_args()
    extract_derived(args.base_json_path, args.output_dir, args.provider, args.model)
