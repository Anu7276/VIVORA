import numpy as np
from typing import List, Dict, Any, Optional
import uuid

class TenantVectorStore:
    """
    Tenant-isolated in-memory Vector Store.
    Each user/session/document maintains its own isolated partition to guarantee
    zero cross-tenant data leakage.
    """
    def __init__(self):
        # tenant_id -> list of chunk records
        self._collections: Dict[str, List[Dict[str, Any]]] = {}

    def insert(self, tenant_id: str, content: str, embedding: List[float], metadata: Optional[Dict[str, Any]] = None) -> str:
        if tenant_id not in self._collections:
            self._collections[tenant_id] = []
        
        chunk_id = str(uuid.uuid4())
        record = {
            "id": chunk_id,
            "content": content,
            "embedding": np.array(embedding, dtype=np.float32),
            "metadata": metadata or {}
        }
        self._collections[tenant_id].append(record)
        return chunk_id

    def search(self, tenant_id: str, query_embedding: List[float], top_k: int = 3) -> List[Dict[str, Any]]:
        collection = self._collections.get(tenant_id, [])
        if not collection:
            return []

        q_vec = np.array(query_embedding, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm > 0:
            q_vec = q_vec / q_norm

        scored = []
        for item in collection:
            doc_vec = item["embedding"]
            score = float(np.dot(q_vec, doc_vec))
            scored.append({
                "id": item["id"],
                "content": item["content"],
                "metadata": item["metadata"],
                "score": score
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

    def clear_tenant(self, tenant_id: str):
        if tenant_id in self._collections:
            del self._collections[tenant_id]

vector_store = TenantVectorStore()
