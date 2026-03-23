import json
import copy
import fitz  # PyMuPDF
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.services.llm_service import llm_service

# Documents with this many pages or fewer get full text extraction (no tree search needed)
SMALL_DOC_PAGE_LIMIT = 20


def _get_tree_structure(tree):
    """Extract the node list from the stored tree wrapper.

    Stored format is {"doc_name": "...", "structure": [...]}.
    """
    if isinstance(tree, dict) and "structure" in tree:
        return tree["structure"]
    if isinstance(tree, list):
        return tree
    if isinstance(tree, dict):
        return [tree]
    return []


def _remove_fields(data, fields=None):
    """Remove specified fields from tree (mirrors pageindex utils.remove_fields)."""
    if fields is None:
        fields = ["text"]
    if isinstance(data, dict):
        return {k: _remove_fields(v, fields) for k, v in data.items() if k not in fields}
    elif isinstance(data, list):
        return [_remove_fields(item, fields) for item in data]
    return data


def _create_node_mapping(structure) -> dict:
    """Build node_id -> node mapping."""
    mapping = {}

    def traverse(node):
        if isinstance(node, dict):
            nid = node.get("node_id")
            if nid:
                mapping[nid] = node
            for child in node.get("nodes", []):
                traverse(child)
        elif isinstance(node, list):
            for item in node:
                traverse(item)

    traverse(structure)
    return mapping


def _extract_pdf_pages(pdf_path: str, start_page: int, end_page: int) -> str:
    """Extract text from specific pages of a PDF with page markers."""
    try:
        doc = fitz.open(pdf_path)
        parts = []
        for page_num in range(max(0, start_page - 1), min(end_page, len(doc))):
            page_text = doc[page_num].get_text()
            if page_text.strip():
                parts.append(f"--- Page {page_num + 1} ---\n{page_text.strip()}")
        doc.close()
        return "\n\n".join(parts)
    except Exception:
        return ""


def _extract_full_pdf_text(pdf_path: str) -> str:
    """Extract all text from a PDF with page markers."""
    try:
        doc = fitz.open(pdf_path)
        parts = []
        for page_num in range(len(doc)):
            page_text = doc[page_num].get_text()
            if page_text.strip():
                parts.append(f"--- Page {page_num + 1} ---\n{page_text.strip()}")
        doc.close()
        return "\n\n".join(parts)
    except Exception:
        return ""


async def _tree_search(user, structure, message) -> list:
    """Use LLM to find relevant nodes in the document tree."""
    tree_without_text = _remove_fields(copy.deepcopy(structure), fields=["text"])

    search_prompt = f"""You are given a question and a tree structure of a document.
Each node contains a node id, node title, and a corresponding summary.
Your task is to find ALL nodes that could contain information relevant to the question.
Be thorough — include every node that might be even partially relevant. It is better to include extra nodes than to miss relevant ones.

Question: {message}

Document tree structure:
{json.dumps(tree_without_text, indent=2)}

Please reply in the following JSON format:
{{
    "thinking": "<Your reasoning about which nodes are relevant>",
    "node_list": ["node_id_1", "node_id_2", ..., "node_id_n"]
}}
Directly return the final JSON structure. Do not output anything else."""

    search_response = await llm_service.completion(
        user=user,
        messages=[{"role": "user", "content": search_prompt}],
    )
    search_text = search_response.choices[0].message.content.strip()

    try:
        if "```" in search_text:
            search_text = search_text.split("```")[1]
            if search_text.startswith("json"):
                search_text = search_text[4:]
        parsed = json.loads(search_text)
        return parsed.get("node_list", [])
    except json.JSONDecodeError:
        import re
        return re.findall(r'"([\w.-]+)"', search_text)


def _get_relevant_content_for_doc(document: dict, message: str = None) -> tuple:
    """Get relevant content extraction params for a single document.
    Returns (page_count, pdf_path, raw_tree, structure) or raises if not indexed."""
    raw_tree = document.get("page_index_tree")
    structure = _get_tree_structure(raw_tree) if raw_tree else []
    page_count = document.get("page_count", 0)
    pdf_path = document.get("file_path", "")
    return page_count, pdf_path, raw_tree, structure


async def _extract_relevant_content(user, document, message) -> str:
    """Extract relevant content from a single document for RAG."""
    page_count, pdf_path, raw_tree, structure = _get_relevant_content_for_doc(document)
    relevant_content = ""

    if page_count <= SMALL_DOC_PAGE_LIMIT and pdf_path:
        relevant_content = _extract_full_pdf_text(pdf_path)
    elif structure:
        node_ids = await _tree_search(user, structure, message)
        node_map = _create_node_mapping(structure)

        pages_to_extract = set()
        for nid in node_ids:
            node = node_map.get(nid)
            if not node:
                continue
            start = node.get("start_index", 0)
            end = node.get("end_index", start)
            if start and end:
                for p in range(start, end + 1):
                    pages_to_extract.add(p)

        if pages_to_extract and pdf_path:
            sorted_pages = sorted(pages_to_extract)
            relevant_content = _extract_pdf_pages(
                pdf_path, sorted_pages[0], sorted_pages[-1]
            )

        if not relevant_content:
            parts = []
            for nid in node_ids:
                node = node_map.get(nid)
                if node and node.get("text"):
                    parts.append(node["text"])
            relevant_content = "\n\n".join(parts)

    if not relevant_content and pdf_path:
        relevant_content = _extract_full_pdf_text(pdf_path)

    return relevant_content


async def chat_with_document(
    db: AsyncIOMotorDatabase,
    user: dict,
    document: dict,
    message: str,
    conversation_id: Optional[str] = None,
    stream: bool = True,
) -> AsyncGenerator[str, None]:
    """PageIndex-style RAG: tree search -> raw PDF extraction -> faithful answer."""
    raw_tree = document.get("page_index_tree")

    if not raw_tree:
        yield "This document hasn't been indexed yet. Please wait for processing to complete."
        return

    structure = _get_tree_structure(raw_tree)

    if not structure:
        yield "Document index is empty. Please re-upload the document."
        return

    # Load or create conversation
    conversation = None
    history_messages = []
    if conversation_id:
        conversation = await db.conversations.find_one(
            {"_id": ObjectId(conversation_id), "user_id": user["_id"]}
        )
        if conversation:
            history_messages = conversation.get("messages", [])[-6:]

    # Get relevant content
    relevant_content = await _extract_relevant_content(user, document, message)

    if not relevant_content:
        relevant_content = "No content found in the document."

    # Generate Answer
    doc_name = document.get("original_filename", "the document")

    system_prompt = f"""You are a document reader for "{doc_name}".

CRITICAL RULES — follow these exactly:
1. You are ONLY allowed to use text that appears in the document content below. You have ZERO outside knowledge. If something is not written in the document, you do not know it.
2. Use the EXACT words, phrases, and sentences from the document. Do NOT rewrite, paraphrase, or rephrase the document content. Copy the original text.
3. You MUST include ALL content from the document that is relevant to the question. Do not skip, summarize, or omit any relevant detail.
4. NEVER add your own commentary, interpretation, opinion, analysis, or conclusion. No sentences like "This shows...", "Overall...", "In summary...", "These highlight...", "This demonstrates...".
5. Organize the document content using markdown (## headers, ### subheaders, **bold**, bullet points) to make it readable and well-structured, but the content itself must be the exact document text.
6. When page numbers are available (e.g., "--- Page 2 ---"), reference them (e.g., "(Page 2)").
7. If the document does not contain relevant information for the question, say exactly: "This information is not found in the document."
8. Your response must end with the last piece of document content. Do NOT add a closing summary or commentary paragraph."""

    answer_messages = [{"role": "system", "content": system_prompt}]

    for msg in history_messages:
        answer_messages.append({
            "role": msg["role"],
            "content": msg["content"],
        })

    answer_prompt = f"""Question: {message}

Document Content:
{relevant_content}

Present ALL relevant content from the document for this question. Use the exact text from the document. Do not add anything that is not in the document."""

    answer_messages.append({"role": "user", "content": answer_prompt})

    # Stream Response
    full_response = ""
    async for chunk in llm_service.stream_completion(
        user=user, messages=answer_messages
    ):
        full_response += chunk
        yield chunk

    # Save to Conversation
    now = datetime.now(timezone.utc)
    user_msg = {"role": "user", "content": message, "timestamp": now}
    assistant_msg = {"role": "assistant", "content": full_response, "timestamp": now}

    if conversation:
        await db.conversations.update_one(
            {"_id": conversation["_id"]},
            {"$push": {"messages": {"$each": [user_msg, assistant_msg]}}},
        )
        yield f"\n\n<!--conv_id:{conversation_id}-->"
    else:
        title = message[:50] + ("..." if len(message) > 50 else "")
        conv = {
            "user_id": user["_id"],
            "document_id": str(document["_id"]),
            "title": title,
            "messages": [user_msg, assistant_msg],
            "created_at": now,
        }
        result = await db.conversations.insert_one(conv)
        new_conv_id = str(result.inserted_id)
        yield f"\n\n<!--conv_id:{new_conv_id}-->"


async def chat_with_multiple_documents(
    db: AsyncIOMotorDatabase,
    user: dict,
    documents: list,
    message: str,
    conversation_id: Optional[str] = None,
    stream: bool = True,
) -> AsyncGenerator[str, None]:
    """Multi-doc RAG: for each document, find relevant content, combine, answer."""
    all_relevant_content = []

    for doc in documents:
        raw_tree = doc.get("page_index_tree")
        if not raw_tree:
            continue

        doc_name = doc.get("original_filename", "unknown")
        content = await _extract_relevant_content(user, doc, message)

        if content:
            all_relevant_content.append(f"=== Document: {doc_name} ===\n{content}")

    if not all_relevant_content:
        yield "No relevant content found in the selected documents."
        return

    combined_content = "\n\n".join(all_relevant_content)
    doc_names = ", ".join(d.get("original_filename", "unknown") for d in documents)

    # Load conversation history
    conversation = None
    history_messages = []
    if conversation_id:
        conversation = await db.conversations.find_one(
            {"_id": ObjectId(conversation_id), "user_id": user["_id"]}
        )
        if conversation:
            history_messages = conversation.get("messages", [])[-6:]

    system_prompt = f"""You are a document reader for multiple documents: {doc_names}.

CRITICAL RULES — follow these exactly:
1. You are ONLY allowed to use text that appears in the document content below. You have ZERO outside knowledge.
2. Use the EXACT words, phrases, and sentences from the documents. Do NOT rewrite, paraphrase, or rephrase.
3. You MUST include ALL content from the documents that is relevant to the question.
4. NEVER add your own commentary, interpretation, opinion, analysis, or conclusion.
5. When referencing content, indicate which document it came from.
6. Organize using markdown (## headers, ### subheaders, **bold**, bullet points).
7. When page numbers are available, reference them.
8. If no document contains relevant information, say: "This information is not found in the provided documents."
9. Do NOT add a closing summary or commentary paragraph."""

    answer_messages = [{"role": "system", "content": system_prompt}]
    for msg in history_messages:
        answer_messages.append({"role": msg["role"], "content": msg["content"]})

    answer_messages.append({
        "role": "user",
        "content": f"Question: {message}\n\nDocument Content:\n{combined_content}\n\nPresent ALL relevant content from the documents for this question. Use the exact text. Do not add anything not in the documents.",
    })

    # Stream response
    full_response = ""
    async for chunk in llm_service.stream_completion(
        user=user, messages=answer_messages
    ):
        full_response += chunk
        yield chunk

    # Save conversation with document_ids
    now = datetime.now(timezone.utc)
    user_msg = {"role": "user", "content": message, "timestamp": now}
    assistant_msg = {"role": "assistant", "content": full_response, "timestamp": now}
    doc_ids = [str(d["_id"]) for d in documents]

    if conversation:
        await db.conversations.update_one(
            {"_id": conversation["_id"]},
            {"$push": {"messages": {"$each": [user_msg, assistant_msg]}}},
        )
        yield f"\n\n<!--conv_id:{conversation_id}-->"
    else:
        title = message[:50] + ("..." if len(message) > 50 else "")
        conv = {
            "user_id": user["_id"],
            "document_ids": doc_ids,
            "document_id": doc_ids[0],
            "title": title,
            "messages": [user_msg, assistant_msg],
            "created_at": now,
        }
        result = await db.conversations.insert_one(conv)
        yield f"\n\n<!--conv_id:{str(result.inserted_id)}-->"


async def get_conversations(db: AsyncIOMotorDatabase, user_id: str, document_id: str) -> list:
    cursor = db.conversations.find(
        {"user_id": user_id, "document_id": document_id},
        {"messages": {"$slice": -1}, "title": 1, "created_at": 1},
    ).sort("created_at", -1)

    conversations = []
    async for conv in cursor:
        conv["_id"] = str(conv["_id"])
        conversations.append(conv)
    return conversations


async def get_multi_conversations(db: AsyncIOMotorDatabase, user_id: str) -> list:
    """Get conversations that span multiple documents."""
    cursor = db.conversations.find(
        {"user_id": user_id, "document_ids": {"$exists": True}},
        {"messages": {"$slice": -1}, "title": 1, "document_ids": 1, "created_at": 1},
    ).sort("created_at", -1)

    conversations = []
    async for conv in cursor:
        conv["_id"] = str(conv["_id"])
        conversations.append(conv)
    return conversations


async def get_conversation(db: AsyncIOMotorDatabase, conversation_id: str, user_id: str) -> dict:
    conv = await db.conversations.find_one(
        {"_id": ObjectId(conversation_id), "user_id": user_id}
    )
    if conv:
        conv["_id"] = str(conv["_id"])
    return conv
