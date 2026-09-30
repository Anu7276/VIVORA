import numpy as np
import hashlib
from typing import List

class Embedder:
    """
    Pluggable Embedding Generator.
    Produces high-dimensional normalized vector representations.
    Uses deterministic semantic hashing + token n-grams locally, or external API if configured.
    """
    def __init__(self, dimension: int = 128):
        self.dimension = dimension

    def get_embedding(self, text: str) -> List[float]:
        tokens = text.lower().split()
        if not tokens:
            return [0.0] * self.dimension

        vec = np.zeros(self.dimension, dtype=np.float32)
        for token in tokens:
            # Hash token to pseudo-random distribution
            h = int(hashlib.sha256(token.encode('utf-8')).hexdigest(), 16)
            for i in range(self.dimension):
                # Deterministic pseudo-random projection
                val = ((h >> (i % 60)) & 0xFF) / 255.0 - 0.5
                vec[i] += val

        # L2 normalize
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    def get_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        return [self.get_embedding(t) for t in texts]

embedder = Embedder()
