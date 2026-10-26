"""Optional Edge adapter: sends narration only, never selects a paid fallback."""
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

async def main():
    request = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if request.get("action") == "status":
        print(json.dumps({"installed": True, "version": edge_tts.__version__}))
        return
    communicate = edge_tts.Communicate(
        request["text"], request["voice"], rate=request.get("rate", "-10%"),
        boundary="WordBoundary", connect_timeout=15, receive_timeout=30,
    )
    boundaries = []
    output = Path(request["output"])
    try:
        with output.open("wb") as media:
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    media.write(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    boundaries.append({"text": chunk["text"], "start": chunk["offset"] / 10_000_000,
                                       "end": (chunk["offset"] + chunk["duration"]) / 10_000_000})
        if not output.stat().st_size or not boundaries:
            raise RuntimeError("No audio or timing metadata received")
        print(json.dumps({"boundaries": boundaries}, ensure_ascii=False))
    except BaseException:
        output.unlink(missing_ok=True)
        raise

if __name__ == "__main__":
    asyncio.run(asyncio.wait_for(main(), timeout=90))
