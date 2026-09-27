from io import BytesIO

from PIL import Image

from spoofscope.visual import difference_hash, hash_similarity


def image_bytes(color: str) -> bytes:
    image = Image.new("RGB", (64, 64), color)
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_visual_hash_is_deterministic():
    first = difference_hash(image_bytes("white"))
    second = difference_hash(image_bytes("white"))
    assert first == second
    assert hash_similarity(first, second) == 1
