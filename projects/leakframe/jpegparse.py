"""JPEG helpers for LeakFrame."""

def is_jpeg(data: bytes) -> bool:
    return len(data) >= 4 and data[:2] == bytes.fromhex("ffd8")
