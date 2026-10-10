import os
import io
import json
import logging
import importlib.util
from typing import List, Dict, Any, Optional, Tuple
from PIL import Image
import numpy as np

logger = logging.getLogger(__name__)

class OCRService:
    _instance = None
    _ocr_engine = None
    _is_available = None
    _init_error = None

    @classmethod
    def is_available(cls) -> bool:
        """
        Fast non-blocking check whether PaddleOCR package is installed.
        Does not download models or block startup.
        """
        if cls._is_available is None:
            spec = importlib.util.find_spec("paddleocr")
            cls._is_available = spec is not None
        return bool(cls._is_available)

    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        available = cls.is_available()
        return {
            "available": available,
            "engine": "PaddleOCR",
            "cpu_mode": True,
            "models_loaded": cls._ocr_engine is not None,
            "error": cls._init_error
        }

    @classmethod
    def get_engine(cls):
        """
        Lazy-loads PaddleOCR engine with CPU-friendly defaults when actually needed.
        use_angle_cls=False for contract documents ensures maximum speed and avoids unnecessary downloads.
        """
        if cls._ocr_engine is not None:
            return cls._ocr_engine
            
        try:
            from paddleocr import PaddleOCR
            logger.info("Initializing PaddleOCR with CPU mode (use_angle_cls=False)...")
            cls._ocr_engine = PaddleOCR(
                use_angle_cls=False,
                lang="en",
                use_gpu=False,
                show_log=False
            )
            cls._is_available = True
            logger.info("PaddleOCR successfully initialized.")
            return cls._ocr_engine
        except Exception as e:
            cls._is_available = False
            cls._init_error = str(e)
            logger.warning(f"PaddleOCR failed to initialize: {e}")
            return None

    @classmethod
    def process_image_bytes(cls, image_bytes: bytes, page_number: int = 1) -> Dict[str, Any]:
        """
        Runs PaddleOCR on image bytes and returns recognized text, lines, and bounding boxes.
        """
        engine = cls.get_engine()
        if not engine:
            return {
                "success": False,
                "error": cls._init_error or "PaddleOCR engine not installed or available",
                "text": "",
                "segments": []
            }

        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            img_np = np.array(image)

            results = engine.ocr(img_np, cls=False)

            recognized_lines = []
            segments = []
            char_offset = 0

            if results and len(results) > 0 and results[0]:
                for idx, line in enumerate(results[0]):
                    box = line[0]  # 4 points
                    text, conf = line[1]
                    text = text.strip()
                    if not text:
                        continue

                    x_coords = [p[0] for p in box]
                    y_coords = [p[1] for p in box]
                    bbox = [
                        round(min(x_coords), 2),
                        round(min(y_coords), 2),
                        round(max(x_coords), 2),
                        round(max(y_coords), 2)
                    ]

                    start_offset = char_offset
                    end_offset = start_offset + len(text)

                    segments.append({
                        "page_number": page_number,
                        "paragraph_index": idx,
                        "section_title": None,
                        "text": text,
                        "bbox": bbox,
                        "confidence": float(conf),
                        "start_offset": start_offset,
                        "end_offset": end_offset,
                        "is_ocr": True
                    })

                    recognized_lines.append(text)
                    char_offset += len(text) + 2

            combined_text = "\n\n".join(recognized_lines)
            return {
                "success": len(combined_text) > 0,
                "text": combined_text,
                "segments": segments,
                "page_number": page_number,
                "error": None if len(combined_text) > 0 else "No text detected by OCR"
            }

        except Exception as e:
            logger.error(f"Error running PaddleOCR on page {page_number}: {e}")
            return {
                "success": False,
                "error": str(e),
                "text": "",
                "segments": []
            }
