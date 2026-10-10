import os
import json
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator
import httpx
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

class GrokAPIError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code

class GrokConfigurationError(GrokAPIError):
    pass

class GrokService:
    @staticmethod
    def get_api_key() -> str:
        key = (settings.AI_API_KEY or os.environ.get("AI_API_KEY", "")).strip()
        return key

    @staticmethod
    def get_base_url() -> str:
        url = (settings.AI_BASE_URL or os.environ.get("AI_BASE_URL", "")).rstrip("/")
        if not url:
            if settings.AI_PROVIDER.lower() == "gemini":
                url = "https://generativelanguage.googleapis.com/v1beta/openai"
            else:
                url = "https://api.x.ai/v1"
        return url

    @staticmethod
    def get_model_name() -> str:
        model = (settings.AI_MODEL or os.environ.get("AI_MODEL", "")).strip()
        if not model:
            if settings.AI_PROVIDER.lower() == "gemini":
                model = "gemini-2.5-flash"
            else:
                model = "grok-2-latest"
        return model

    @classmethod
    def validate_configuration(cls) -> None:
        key = cls.get_api_key()
        if not key:
            provider_name = "Gemini" if settings.AI_PROVIDER.lower() == "gemini" else "xAI"
            raise GrokConfigurationError(
                f"{provider_name} API key is missing. Please set AI_API_KEY in .env.local (development) or environment variables (Render)."
            )

    @classmethod
    async def chat_completion(
        cls,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[Any] = None,
        temperature: float = 0.2,
        max_tokens: int = 4096,
        timeout: float = 60.0
    ) -> Dict[str, Any]:
        """
        Sends a standard non-streaming chat completion request to the xAI API.
        """
        cls.validate_configuration()
        api_key = cls.get_api_key()
        base_url = cls.get_base_url()
        model = cls.get_model_name()

        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            payload["tools"] = tools
        if tool_choice:
            payload["tool_choice"] = tool_choice

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        url = f"{base_url}/chat/completions"
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, json=payload, headers=headers)
                if response.status_code == 401:
                    raise GrokAPIError("Authentication failed: Invalid xAI API key.", status_code=401)
                elif response.status_code == 429:
                    raise GrokAPIError("Rate limit exceeded on xAI API. Please try again shortly.", status_code=429)
                elif response.status_code >= 400:
                    err_msg = response.text
                    try:
                        err_json = response.json()
                        err_msg = err_json.get("error", {}).get("message", err_msg)
                    except Exception:
                        pass
                    raise GrokAPIError(f"xAI API Error ({response.status_code}): {err_msg}", status_code=response.status_code)

                return response.json()
        except httpx.TimeoutException:
            raise GrokAPIError("Request to xAI API timed out.", status_code=504)
        except httpx.RequestError as e:
            raise GrokAPIError(f"Network error communicating with xAI API: {e}")

    @classmethod
    async def stream_chat_completion(
        cls,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[Any] = None,
        temperature: float = 0.2,
        max_tokens: int = 4096,
        timeout: float = 90.0
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Streams chat completions from the xAI API over Server-Sent Events.
        Yields parsed delta objects containing content chunks and tool calls.
        """
        cls.validate_configuration()
        api_key = cls.get_api_key()
        base_url = cls.get_base_url()
        model = cls.get_model_name()

        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }
        if tools:
            payload["tools"] = tools
        if tool_choice:
            payload["tool_choice"] = tool_choice

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        url = f"{base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                async with client.stream("POST", url, json=payload, headers=headers) as response:
                    if response.status_code == 401:
                        raise GrokAPIError("Authentication failed: Invalid xAI API key.", status_code=401)
                    elif response.status_code == 429:
                        raise GrokAPIError("Rate limit exceeded on xAI API.", status_code=429)
                    elif response.status_code >= 400:
                        body = await response.aread()
                        raise GrokAPIError(f"xAI API Error ({response.status_code}): {body.decode(errors='ignore')}", status_code=response.status_code)

                    buffer = ""
                    async for chunk in response.aiter_text():
                        buffer += chunk
                        while "\n" in buffer:
                            line, buffer = buffer.split("\n", 1)
                            line = line.strip()
                            if not line or line.startswith(":"):
                                continue
                            if line.startswith("data: "):
                                data_str = line[6:].strip()
                                if data_str == "[DONE]":
                                    yield {"done": True}
                                    return
                                try:
                                    data_obj = json.loads(data_str)
                                    choices = data_obj.get("choices", [])
                                    if choices:
                                        delta = choices[0].get("delta", {})
                                        finish_reason = choices[0].get("finish_reason")
                                        yield {
                                            "content": delta.get("content", ""),
                                            "tool_calls": delta.get("tool_calls", None),
                                            "finish_reason": finish_reason,
                                            "done": False
                                        }
                                except json.JSONDecodeError:
                                    continue
            except httpx.TimeoutException:
                raise GrokAPIError("Streaming request to xAI API timed out.", status_code=504)
            except httpx.RequestError as e:
                raise GrokAPIError(f"Streaming network error with xAI API: {e}")
