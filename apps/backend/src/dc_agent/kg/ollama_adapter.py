import httpx
import json
from typing import Any, Dict, List, Optional, Type, Union
from graphiti_core.llm_client.client import LLMClient
from graphiti_core.embedder.client import EmbedderClient
from graphiti_core.prompts.models import Message
from graphiti_core.llm_client.config import ModelSize
from pydantic import BaseModel

class OllamaEmbedder(EmbedderClient):
    """Ollama implementation of EmbedderClient."""
    
    def __init__(self, base_url: str, model: str):
        self.base_url = base_url
        self.model = model

    async def create(self, input_data: Union[str, List[str], Any]) -> List[float]:
        """Create an embedding for a single input."""
        if isinstance(input_data, list):
            # If list of strings, assume single item for 'create' or handle appropriately?
            # Base method signature suggests input_data can be list[str] but return is list[float].
            # This implies 'create' is for a single vector return.
            # If input is a list, we probably should join it or embed the first item? 
            # Or maybe the signature implies it handles token IDs. 
            # For simplicity with Ollama, let's treat it as text.
            if isinstance(input_data, list) and isinstance(input_data[0], str):
                text = " ".join(input_data)
            else:
                text = str(input_data)
        else:
            text = str(input_data)

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text}
            )
            response.raise_for_status()
            return response.json()["embedding"]

    async def create_batch(self, input_data_list: List[str]) -> List[List[float]]:
        """Create embeddings for a batch of inputs."""
        # Ollama doesn't have a native batch endpoint that is standard across versions,
        # so we loop sequentially for now. Parallelize if needed.
        embeddings = []
        for text in input_data_list:
            embeddings.append(await self.create(text))
        return embeddings

class DummyTracer:
    def start_span(self, name, **kwargs):
        return self
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def end(self, **kwargs):
        pass

    def add_attributes(self, *args, **kwargs):
        pass

    def set_status(self, *args, **kwargs):
        pass

    def add_event(self, *args, **kwargs):
        pass

    def record_exception(self, *args, **kwargs):
        pass

class OllamaLLMClient(LLMClient):
    """Ollama implementation of LLMClient."""
    
    def __init__(self, base_url: str, model: str):
        self.base_url = base_url
        self.model = model
        self.max_tokens = 4096
        self.tracer = DummyTracer()
        self.cache_enabled = False

    def _clean_json(self, content: str) -> str:
        """Clean JSON content from Markdown code blocks."""
        # Remove markdown code blocks
        if "```" in content:
            # Try to match json block
            import re
            match = re.search(r"```(?:json)?\s*(.*?)\s*```", content, re.DOTALL)
            if match:
                return match.group(1)
            # Fallback for just removing backticks if regex fails for some reason
            content = content.replace("```json", "").replace("```", "")
        return content.strip()

    async def _generate_response(
        self,
        messages: List[Message],
        response_model: Optional[Type[BaseModel]] = None,
        max_tokens: Optional[int] = None,
        model_size: ModelSize = ModelSize.medium, # Ignored for fixed model adapter
        group_id: Optional[str] = None,
        prompt_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate a response using Ollama."""
        
        # Convert Graphiti Messages to Ollama format
        ollama_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

        payload = {
            "model": self.model,
            "messages": ollama_messages,
            "stream": False,
        }
        
        if response_model:
            payload["format"] = "json"
            
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(f"{self.base_url}/api/chat", json=payload)
            response.raise_for_status()
            result = response.json()
            
            content = result["message"]["content"]
            print(f"DEBUG: Ollama raw content: {content[:500]}...") 
            
            if response_model:
                try:
                    # Clean and parse JSON
                    cleaned_content = self._clean_json(content)
                    data = json.loads(cleaned_content)
                    validated = response_model.model_validate(data)
                    return validated.model_dump()
                except Exception as e:
                    print(f"Failed to parse/validate JSON from Ollama: {e}")
                    print(f"Cleaned content was: {cleaned_content[:500]}...")
                    return {} 
            
            return {"content": content}

    def set_tracer(self, tracer: Any) -> None:
        pass
