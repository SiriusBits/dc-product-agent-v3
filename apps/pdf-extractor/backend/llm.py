import os
import time
from typing import Optional, List, Union
from pathlib import Path
import google.generativeai as genai
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

class LLMClient:
    def __init__(self, provider: str = "gemini", model: str = "gemini-3-pro-preview"):
        self.provider = provider
        self.model = model
        
        if self.provider == "gemini":
            api_key = os.getenv("GOOGLE_API_KEY")
            if not api_key:
                raise ValueError("GOOGLE_API_KEY not found in environment variables.")
            genai.configure(api_key=api_key)
            self.client = genai.GenerativeModel(model_name=self.model)
        elif self.provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY not found in environment variables.")
            self.client = OpenAI(api_key=api_key)
        else:
            raise ValueError(f"Unsupported provider: {provider}")

    def call(self, prompt: str, images: Optional[List[Union[str, Path]]] = None) -> str:
        """
        Call the LLM with a prompt and optional images.
        """
        if self.provider == "gemini":
            return self._call_gemini(prompt, images)
        elif self.provider == "openai":
            return self._call_openai(prompt, images)
        return ""

    def _call_gemini(self, prompt: str, images: Optional[List[Union[str, Path]]] = None) -> str:
        content = [prompt]
        if images:
            for img_path in images:
                path = Path(img_path)
                if not path.exists():
                    print(f"Warning: Image not found at {path}")
                    continue
                
                # Load image data
                mime_type = "image/jpeg"
                if path.suffix.lower() == ".png":
                    mime_type = "image/png"
                elif path.suffix.lower() == ".pdf":
                    mime_type = "application/pdf"
                
                # For Gemini, we can pass the file path directly if using the File API, 
                # but for simplicity here we might upload or read bytes.
                # Actually, for local files, we can read bytes.
                with open(path, "rb") as f:
                    data = f.read()
                
                content.append({
                    "mime_type": mime_type,
                    "data": data
                })

        try:
            response = self.client.generate_content(content)
            return response.text
        except Exception as e:
            print(f"Error calling Gemini: {e}")
            raise

    def _call_openai(self, prompt: str, images: Optional[List[Union[str, Path]]] = None) -> str:
        messages = [{"role": "user", "content": []}]
        
        # Add text
        messages[0]["content"].append({"type": "text", "text": prompt})
        
        # Add images
        if images:
            import base64
            for img_path in images:
                path = Path(img_path)
                if not path.exists():
                    continue
                
                with open(path, "rb") as f:
                    base64_image = base64.b64encode(f.read()).decode('utf-8')
                
                mime_type = "image/jpeg"
                if path.suffix.lower() == ".png":
                    mime_type = "image/png"
                
                messages[0]["content"].append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime_type};base64,{base64_image}"
                    }
                })

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=4096
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error calling OpenAI: {e}")
            raise
