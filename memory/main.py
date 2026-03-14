import time
import uuid

import chromadb
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="ARIA Memory Service")

chroma_client = chromadb.PersistentClient(path="/app/chroma_data")
conversations = chroma_client.get_or_create_collection(
    name="conversations",
    metadata={"hnsw:space": "cosine"},
)
background = chroma_client.get_or_create_collection(
    name="background",
    metadata={"hnsw:space": "cosine"},
)


class StoreRequest(BaseModel):
    text: str
    role: str = "user"
    metadata: dict | None = None


class SearchRequest(BaseModel):
    query: str
    n_results: int = 5


class BackgroundRequest(BaseModel):
    fact: str
    category: str = "general"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/memory/store")
def store_message(req: StoreRequest):
    doc_id = str(uuid.uuid4())
    meta = {"role": req.role, "timestamp": time.time()}
    if req.metadata:
        meta.update(req.metadata)
    conversations.add(documents=[req.text], metadatas=[meta], ids=[doc_id])
    return {"id": doc_id, "status": "stored"}


@app.post("/memory/search")
def search_memory(req: SearchRequest):
    if conversations.count() == 0:
        return {"results": []}
    results = conversations.query(query_texts=[req.query], n_results=req.n_results)
    items = []
    for i, doc in enumerate(results["documents"][0]):
        items.append({
            "text": doc,
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i],
        })
    return {"results": items}


@app.post("/memory/background")
def store_background(req: BackgroundRequest):
    doc_id = str(uuid.uuid4())
    meta = {"category": req.category, "timestamp": time.time()}
    background.add(documents=[req.fact], metadatas=[meta], ids=[doc_id])
    return {"id": doc_id, "status": "stored"}


@app.delete("/memory/purge")
def purge_memory():
    """Wipe all conversations and background memory."""
    global conversations, background
    chroma_client.delete_collection("conversations")
    chroma_client.delete_collection("background")
    conversations = chroma_client.get_or_create_collection(
        name="conversations",
        metadata={"hnsw:space": "cosine"},
    )
    background = chroma_client.get_or_create_collection(
        name="background",
        metadata={"hnsw:space": "cosine"},
    )
    return {"status": "purged"}


@app.get("/memory/recent")
def get_recent(limit: int = 10):
    if conversations.count() == 0:
        return {"messages": []}
    all_docs = conversations.get(include=["documents", "metadatas"])
    paired = list(zip(all_docs["documents"], all_docs["metadatas"]))
    paired.sort(key=lambda x: x[1].get("timestamp", 0), reverse=True)
    paired = paired[:limit]
    return {
        "messages": [
            {"text": doc, "metadata": meta} for doc, meta in paired
        ]
    }
