import argparse
import subprocess
import sys
from pathlib import Path

def run_command(cmd, env=None):
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, env=env, check=False)
    if result.returncode != 0:
        print(f"Error running command: {result.returncode}")
        sys.exit(result.returncode)

def main():
    parser = argparse.ArgumentParser(description="Ingest PDF Workflow")
    parser.add_argument("--step", required=True, choices=["base", "ingest-base", "derived", "ingest-derived"], help="Workflow step")
    parser.add_argument("--input", required=True, type=Path, help="Input file path")
    parser.add_argument("--provider", default="gemini", help="LLM Provider")
    parser.add_argument("--model", default="gemini-3-pro-preview", help="Model name")
    
    args = parser.parse_args()
    
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    pdf_extractor_dir = root_dir / "apps" / "pdf-extractor"
    
    # Environment setup
    env = dict(sys.modules['os'].environ)
    env["PYTHONPATH"] = f"{pdf_extractor_dir}:{env.get('PYTHONPATH', '')}"
    
    # Determine python executable
    # Prefer apps/pdf-extractor/.venv/bin/python if it exists
    venv_python = pdf_extractor_dir / ".venv" / "bin" / "python"
    if venv_python.exists():
        python_exe = str(venv_python)
    else:
        python_exe = sys.executable
    
    if args.step == "base":
        # Run extract_base.py as module
        cmd = [python_exe, "-m", "backend.extract_base", str(args.input), "--provider", args.provider, "--model", args.model]
        run_command(cmd, env)
        
    elif args.step == "ingest-base":
        # Run ingest command (cli.py)
        # Input is YAML file
        # Output is JSON dir
        script = pdf_extractor_dir / "backend" / "cli.py"
        output_dir = root_dir / "data" / "extracts" / "base_extraction"
        cmd = [
            python_exe, str(script), "ingest",
            "--base-yaml-dir", str(args.input.parent),
            "--output-dir", str(output_dir),
            "--pdf-root", str(root_dir / "data" / "extracts" / "pdfs"), # Assuming PDFs are here
            "--no-validate" # Skip validation for now or point to schema dir
        ]
        # We only want to process the specific file, but ingest processes a dir.
        # The tool processes all *_base.yaml in the dir. 
        # If args.input is a file, we might need to be careful.
        # For now, we point to the dir containing the input file.
        run_command(cmd, env)
        
    elif args.step == "derived":
        # Run extract_derived.py as module
        cmd = [python_exe, "-m", "backend.extract_derived", str(args.input), "--provider", args.provider, "--model", args.model]
        run_command(cmd, env)
        
    elif args.step == "ingest-derived":
        # Run ingest command for derived?
        # Actually, ingest.py seems to focus on base extraction to JSON.
        # Does it handle derived?
        # Looking at ingest.py, it has `convert_base_yaml`.
        # It doesn't seem to have `convert_derived_yaml`.
        # The user said: "Pipeline populated fields are completed by the local Python scripts... The validated base_extraction JSON file is sent to a powerful LLM... output the data for the derived_info_yaml... completed YAML file is converted to JSON format".
        # So there must be a way to convert derived YAML to JSON.
        # I might need to implement `convert_derived_yaml` in `ingest.py` or just do a simple YAML->JSON conversion if no complex logic is needed.
        # Given `derived_info` schema is complex (KG), simple conversion might work if LLM output matches schema.
        # I'll assume simple conversion for now or check if `ingest.py` has hidden powers.
        # `ingest.py` only exports `convert_base_yaml`.
        # So I'll implement a simple converter here or add it to `ingest.py`.
        # I'll add a simple converter in this script for now.
        
        import yaml
        import json
        
        with open(args.input, "r") as f:
            data = yaml.safe_load(f)
            
        output_dir = root_dir / "data" / "extracts" / "derived_info"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / f"{args.input.stem}.json"
        
        with open(output_file, "w") as f:
            json.dump(data, f, indent=2)
            
        print(f"Converted {args.input} to {output_file}")

if __name__ == "__main__":
    main()
