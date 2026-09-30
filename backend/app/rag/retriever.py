from typing import List, Dict, Any
from app.rag.embedder import embedder
from app.rag.vector_store import vector_store

class RAGRetriever:
    """
    RAG Retriever used by:
    1. Question agent (for generating topic-grounded questions)
    2. Evaluator agent (for fetching reference answers)
    3. Doubt agent (for answering student doubts)
    """
    def __init__(self):
        self.embedder = embedder
        self.store = vector_store

    def retrieve(self, tenant_id: str, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        query_embedding = self.embedder.get_embedding(query)
        return self.store.search(tenant_id=tenant_id, query_embedding=query_embedding, top_k=top_k)

    def get_context_string(self, tenant_id: str, query: str, top_k: int = 3) -> str:
        matches = self.retrieve(tenant_id, query, top_k=top_k)
        if not matches:
            return ""
        return "\n\n".join([f"[{m['metadata'].get('topic_tag', 'Topic')}]: {m['content']}" for m in matches])

rag_retriever = RAGRetriever()
