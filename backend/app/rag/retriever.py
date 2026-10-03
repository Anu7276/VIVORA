import math
import re
from collections import Counter, OrderedDict
from typing import List, Dict, Any, Optional
from app.db.database import SessionLocal
from app.db.models import DocumentChunk
from app.rag.vector_store import vector_store


class BM25Index:
    """
    Okapi BM25 Lexical Search Index.
    Deterministic, restart-safe, and avoids pseudo-random hash projection aliasing.
    """
    def __init__(self, records: List[Dict[str, Any]], k1: float = 1.5, b: float = 0.75):
        self.records = records
        self.k1 = k1
        self.b = b
        self.N = len(records)
        
        self.doc_tokens: List[List[str]] = []
        self.doc_lens: List[int] = []
        self.df: Counter = Counter()

        for rec in records:
            tokens = self._tokenize(rec["content"])
            self.doc_tokens.append(tokens)
            self.doc_lens.append(len(tokens))
            unique_tokens = set(tokens)
            for t in unique_tokens:
                self.df[t] += 1

        self.avgdl = (sum(self.doc_lens) / self.N) if self.N > 0 else 1.0

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        return re.findall(r"\b[a-z0-9_]{2,}\b", (text or "").lower())

    def search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        if not self.records or self.N == 0:
            return []

        q_tokens = self._tokenize(query)
        if not q_tokens:
            return []

        scores: List[float] = [0.0] * self.N

        for q in q_tokens:
            n_q = self.df.get(q, 0)
            if n_q == 0:
                continue

            # Standard BM25 IDF with smoothing
            idf = math.log(((self.N - n_q + 0.5) / (n_q + 0.5)) + 1.0)
            if idf <= 0:
                idf = 0.05  # small positive floor for ubiquitous matching terms

            for i in range(self.N):
                doc_t = self.doc_tokens[i]
                if not doc_t:
                    continue
                # Term frequency in document
                tf = doc_t.count(q)
                if tf == 0:
                    continue

                d_len = self.doc_lens[i]
                denom = tf + self.k1 * (1.0 - self.b + self.b * (d_len / self.avgdl))
                scores[i] += idf * ((tf * (self.k1 + 1.0)) / denom)

        ranked = []
        for i, score in enumerate(scores):
            rec = self.records[i]
            ranked.append({
                "id": rec["id"],
                "content": rec["content"],
                "metadata": rec.get("metadata", {}),
                "score": round(score, 4)
            })

        ranked.sort(key=lambda x: x["score"], reverse=True)
        # If top scores are > 0, return only matching items or top_k
        matching = [r for r in ranked if r["score"] > 0]
        if matching:
            return matching[:top_k]
        return ranked[:top_k]


class RAGRetriever:
    """
    RAG Retriever used by:
    1. Question agent (for generating topic-grounded questions)
    2. Evaluator agent (for fetching reference answers)
    3. Doubt agent (for answering student doubts)

    Retrieval is restart-safe:
    - Loads DocumentChunk records directly from the database on demand.
    - Caches index per tenant/document in an LRU with size cap (default 128).
    """
    def __init__(self, cache_size: int = 128):
        self.cache_size = cache_size
        self._cache: OrderedDict[str, BM25Index] = OrderedDict()

    def clear_cache(self, tenant_id: Optional[str] = None) -> None:
        if tenant_id:
            self._cache.pop(tenant_id, None)
            vector_store.clear_tenant(tenant_id)
        else:
            self._cache.clear()
            vector_store._collections.clear()

    def get_index(self, tenant_id: str) -> Optional[BM25Index]:
        if not tenant_id:
            return None

        if tenant_id in self._cache:
            self._cache.move_to_end(tenant_id)
            return self._cache[tenant_id]

        # Load chunks from DB
        db = SessionLocal()
        try:
            db_chunks = (
                db.query(DocumentChunk)
                .filter(DocumentChunk.document_id == tenant_id)
                .order_by(DocumentChunk.chunk_index)
                .all()
            )
            records: List[Dict[str, Any]] = []
            if db_chunks:
                for c in db_chunks:
                    records.append({
                        "id": c.id,
                        "content": c.content,
                        "metadata": {
                            "topic_tag": c.topic_tag or "General",
                            "chunk_index": c.chunk_index
                        }
                    })
            else:
                # Fallback to in-memory vector store if available
                legacy = vector_store._collections.get(tenant_id, [])
                for l in legacy:
                    records.append({
                        "id": l["id"],
                        "content": l["content"],
                        "metadata": l.get("metadata", {})
                    })

            if not records:
                return None

            idx = BM25Index(records)
            self._cache[tenant_id] = idx
            if len(self._cache) > self.cache_size:
                self._cache.popitem(last=False)
            return idx
        finally:
            db.close()

    def invalidate_cache(self, tenant_id: str) -> None:
        """Evict cached index for tenant/document when updated or deleted."""
        self.clear_cache(tenant_id)

    def retrieve(self, tenant_id: str, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        idx = self.get_index(tenant_id)
        if not idx:
            return []
        return idx.search(query=query, top_k=top_k)

    def get_context_string(self, tenant_id: str, query: str, top_k: int = 3) -> str:
        matches = self.retrieve(tenant_id, query, top_k=top_k)
        if not matches:
            return ""
        return "\n\n".join([f"[{m['metadata'].get('topic_tag', 'Topic')}]: {m['content']}" for m in matches])


rag_retriever = RAGRetriever()
