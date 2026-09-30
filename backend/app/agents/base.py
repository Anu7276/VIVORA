from abc import ABC
import logging
from app.llm.router import llm_router
from app.rag.retriever import rag_retriever

logger = logging.getLogger("vivora.agent")

class BaseAgent(ABC):
    """
    Base Agent with access to LLM router and RAG retriever.
    Agents are stateless workers activated only when needed.
    """
    def __init__(self, name: str):
        self.name = name
        self.llm = llm_router
        self.rag = rag_retriever
