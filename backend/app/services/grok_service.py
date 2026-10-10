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
    def get_candidate_models(cls) -> List[str]:
        configured = (settings.AI_MODEL or os.environ.get("AI_MODEL", "")).strip()
        if settings.AI_PROVIDER.lower() == "gemini":
            candidates = [
                # Ultra-fast, high-quota models first for instantaneous sub-second responses:
                "gemini-3.5-flash-lite",
                "gemini-3.5-flash",
                "gemini-3-flash-preview",
                "gemini-flash-lite-latest",
                configured or "gemini-3.5-flash-lite",
                "gemini-2.5-flash-lite",
                "gemini-2.5-flash"
            ]
        else:
            candidates = [
                configured or "grok-2-latest",
                "grok-2-latest",
                "grok-beta"
            ]
        seen = set()
        result = []
        for c in candidates:
            if c and c not in seen:
                seen.add(c)
                result.append(c)
        return result

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
        timeout: float = 25.0
    ) -> Dict[str, Any]:
        """
        Sends a standard non-streaming chat completion request to the AI provider.
        Automatically falls back across viable models if 429, 503, or quota limits are encountered.
        """
        cls.validate_configuration()
        api_key = cls.get_api_key()
        base_url = cls.get_base_url()
        candidate_models = cls.get_candidate_models()

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        url = f"{base_url}/chat/completions"
        last_error = None

        for model in candidate_models:
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

            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(url, json=payload, headers=headers)
                    if response.status_code in (429, 502, 503, 504):
                        logger.warning(f"Model {model} returned status {response.status_code}. Retrying with next candidate...")
                        last_error = GrokAPIError(f"Model {model} temporarily unavailable ({response.status_code}).", status_code=response.status_code)
                        continue
                    elif response.status_code == 401:
                        raise GrokAPIError("Authentication failed: Invalid API key.", status_code=401)
                    elif response.status_code >= 400:
                        err_msg = response.text
                        try:
                            err_json = response.json()
                            err_msg = err_json.get("error", {}).get("message", err_msg)
                        except Exception:
                            pass
                        # If resource exhausted, high demand, or quota error, try next candidate
                        if any(phrase in err_msg.lower() for phrase in ["resource_exhausted", "quota", "demand", "overloaded", "unavailable"]):
                            logger.warning(f"Model {model} unavailable ({err_msg}). Trying fallback...")
                            last_error = GrokAPIError(f"Model {model} unavailable: {err_msg}", status_code=response.status_code)
                            continue
                        raise GrokAPIError(f"API Error ({response.status_code}): {err_msg}", status_code=response.status_code)

                    return response.json()
            except httpx.TimeoutException:
                logger.warning(f"Request to model {model} timed out. Trying next candidate...")
                last_error = GrokAPIError(f"Request to {model} timed out.", status_code=504)
                continue
            except httpx.RequestError as e:
                logger.warning(f"Network error communicating with {model}: {e}. Trying next candidate...")
                last_error = GrokAPIError(f"Network error with {model}: {e}")
                continue

        if last_error:
            raise last_error
        raise GrokAPIError("All candidate AI models failed to respond.")

    @classmethod
    async def stream_chat_completion(
        cls,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[Any] = None,
        temperature: float = 0.2,
        max_tokens: int = 4096,
        timeout: float = 30.0
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Streams chat completions from the AI API over Server-Sent Events.
        Automatically retries with fallback candidate models if 429, 503, or transient failures occur.
        """
        cls.validate_configuration()
        api_key = cls.get_api_key()
        base_url = cls.get_base_url()
        candidate_models = cls.get_candidate_models()

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        url = f"{base_url}/chat/completions"
        last_error = None
        succeeded = False

        for model in candidate_models:
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

            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    async with client.stream("POST", url, json=payload, headers=headers) as response:
                        if response.status_code in (429, 502, 503, 504):
                            logger.warning(f"Streaming: Model {model} returned {response.status_code}. Retrying with next candidate...")
                            last_error = GrokAPIError(f"Model {model} temporarily unavailable ({response.status_code}).", status_code=response.status_code)
                            continue
                        elif response.status_code == 401:
                            raise GrokAPIError("Authentication failed: Invalid API key.", status_code=401)
                        elif response.status_code >= 400:
                            body = await response.aread()
                            err_text = body.decode(errors="ignore")
                            if any(phrase in err_text.lower() for phrase in ["resource_exhausted", "quota", "demand", "overloaded", "unavailable"]):
                                logger.warning(f"Streaming: Model {model} unavailable ({err_text}). Retrying with next candidate...")
                                last_error = GrokAPIError(f"Model {model} unavailable.", status_code=response.status_code)
                                continue
                            raise GrokAPIError(f"API Error ({response.status_code}): {err_text}", status_code=response.status_code)

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
                        succeeded = True
                        return
            except GrokAPIError:
                raise
            except httpx.TimeoutException:
                logger.warning(f"Streaming from model {model} timed out. Retrying with next candidate...")
                last_error = GrokAPIError(f"Streaming request to {model} timed out.", status_code=504)
                continue
            except httpx.RequestError as e:
                logger.warning(f"Streaming network error with {model}: {e}. Retrying with next candidate...")
                last_error = GrokAPIError(f"Streaming network error with {model}: {e}")
                continue

        if not succeeded:
            if last_error:
                raise last_error
            raise GrokAPIError("All candidate AI models failed to stream response.")
