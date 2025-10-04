"""Chat and conversational endpoints."""

import logging
import time
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import selectinload

from ..database.connection import get_database_manager
from ..database.models import Conversation as ConversationModel
from ..database.models import Message as MessageModel
from ..models.api_models import (
    ApiResponse,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    Conversation,
    QueryAnalysis,
    QueryType,
    RetrievalResult,
)
from ..retrieval.hybrid_service import HybridRetrievalService
from ..retrieval.query_router import QueryRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


# Service dependencies
async def get_query_router() -> QueryRouter:
    """Get query router service."""
    return QueryRouter()


async def get_retrieval_service() -> HybridRetrievalService:
    """Get hybrid retrieval service."""
    service = HybridRetrievalService()
    if not service._initialized:
        await service.initialize()
    return service


@router.post("/", response_model=ApiResponse[ChatResponse])
async def chat(
    request: ChatRequest,
    query_router: QueryRouter = Depends(get_query_router),
    retrieval_service: HybridRetrievalService = Depends(get_retrieval_service),
) -> ApiResponse[ChatResponse]:
    """Main chat endpoint for conversational queries."""
    start_time = time.time()

    try:
        # Generate conversation ID if not provided
        conversation_id = request.conversation_id or str(uuid4())

        # Validate query
        if not request.query.strip():
            raise HTTPException(status_code=400, detail="Query cannot be empty")

        logger.info(f"Processing chat request: '{request.query[:100]}...'")

        # 1. Analyze query using query router
        query_analysis = query_router.analyze_query(request.query)
        logger.info(f"Query analysis: type={query_analysis.query_type}, confidence={query_analysis.intent_confidence}")

        # 2. Perform hybrid retrieval
        retrieval_results, updated_analysis = await retrieval_service.search(
            query=request.query,
            max_results=request.max_results or 10,
            vector_weight=request.query_options.vector_weight if request.query_options else None,
            kg_weight=request.query_options.kg_weight if request.query_options else None,
            min_confidence=request.query_options.min_confidence if request.query_options else 0.1,
        )

        # Filter sources if requested
        sources = retrieval_results if request.include_sources else []

        # 3. Generate response using retrieved context
        answer = await _generate_response(
            query=request.query,
            analysis=updated_analysis,
            sources=retrieval_results,
        )

        # Check if KG was used in retrieval
        kg_enhanced = any(result.source in ["kg", "hybrid"] for result in retrieval_results)

        response_time_ms = int((time.time() - start_time) * 1000)

        # 4. Store conversation in database
        await _store_conversation_message(
            conversation_id=conversation_id,
            user_message=request.query,
            assistant_message=answer,
            sources=sources,
            query_analysis=updated_analysis,
        )

        chat_response = ChatResponse(
            answer=answer,
            sources=sources,
            conversation_id=conversation_id,
            query_analysis=updated_analysis,
            response_time_ms=response_time_ms,
            kg_enhanced=kg_enhanced,
        )

        logger.info(f"Chat response generated in {response_time_ms}ms with {len(sources)} sources")

        return ApiResponse(
            data=chat_response,
            message="Chat response generated successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process chat request: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to process chat request: {str(e)}"
        )


@router.get(
    "/conversations/{conversation_id}", response_model=ApiResponse[Conversation]
)
async def get_conversation(conversation_id: str) -> ApiResponse[Conversation]:
    """Get conversation history by ID."""
    try:
        # Validate UUID format
        try:
            conversation_uuid = UUID(conversation_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid conversation ID format")

        db_manager = await get_database_manager()

        async with db_manager.get_session() as session:
            # Query conversation with messages
            stmt = (
                select(ConversationModel)
                .options(selectinload(ConversationModel.messages))
                .where(ConversationModel.id == conversation_uuid)
            )
            result = await session.execute(stmt)
            db_conversation = result.scalar_one_or_none()

            if not db_conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")

            # Convert database model to API model
            messages = []
            for db_message in sorted(db_conversation.messages, key=lambda m: m.created_at):
                # Parse sources from metadata if available
                sources = []
                if db_message.metadata and "sources" in db_message.metadata:
                    for source_data in db_message.metadata["sources"]:
                        sources.append(RetrievalResult(**source_data))

                message = ChatMessage(
                    id=str(db_message.id),
                    content=db_message.content,
                    role=db_message.role,
                    sources=sources if sources else None,
                    timestamp=db_message.created_at,
                    conversation_id=conversation_id,
                )
                messages.append(message)

            conversation = Conversation(
                id=conversation_id,
                messages=messages,
                created_at=db_conversation.created_at,
                updated_at=db_conversation.updated_at,
                title=db_conversation.title,
                metadata={"message_count": len(messages)},
            )

            return ApiResponse(
                data=conversation,
                message="Conversation retrieved successfully"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve conversation {conversation_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve conversation: {str(e)}"
        )


@router.get("/conversations", response_model=ApiResponse[list[Conversation]])
async def list_conversations(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    # TODO: Add user_id parameter when authentication is implemented
) -> ApiResponse[list[Conversation]]:
    """List user conversations."""
    try:
        db_manager = await get_database_manager()

        async with db_manager.get_session() as session:
            # Query conversations ordered by most recent
            stmt = (
                select(ConversationModel)
                .options(selectinload(ConversationModel.messages))
                .order_by(desc(ConversationModel.updated_at))
                .limit(limit)
                .offset(offset)
            )

            # TODO: Add user filter when authentication is implemented
            # .where(ConversationModel.user_id == current_user.id)

            result = await session.execute(stmt)
            db_conversations = result.scalars().all()

            # Convert to API models
            conversations = []
            for db_conv in db_conversations:
                # Get message count and preview
                message_count = len(db_conv.messages)
                latest_message = None
                if db_conv.messages:
                    latest_msg = max(db_conv.messages, key=lambda m: m.created_at)
                    latest_message = latest_msg.content[:100] + "..." if len(latest_msg.content) > 100 else latest_msg.content

                # Generate title if not set
                title = db_conv.title
                if not title and db_conv.messages:
                    first_user_msg = next(
                        (m for m in sorted(db_conv.messages, key=lambda x: x.created_at) if m.role == "user"),
                        None
                    )
                    if first_user_msg:
                        title = first_user_msg.content[:50] + "..." if len(first_user_msg.content) > 50 else first_user_msg.content

                conversation = Conversation(
                    id=str(db_conv.id),
                    messages=[],  # Don't include full messages in list view
                    created_at=db_conv.created_at,
                    updated_at=db_conv.updated_at,
                    title=title or "Untitled Conversation",
                    metadata={
                        "message_count": message_count,
                        "latest_message": latest_message,
                    },
                )
                conversations.append(conversation)

            return ApiResponse(
                data=conversations,
                message=f"Retrieved {len(conversations)} conversations"
            )

    except Exception as e:
        logger.error(f"Failed to list conversations: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to list conversations: {str(e)}"
        )


@router.delete("/conversations/{conversation_id}", response_model=ApiResponse[dict])
async def delete_conversation(conversation_id: str) -> ApiResponse[dict]:
    """Delete a conversation."""
    try:
        # Validate UUID format
        try:
            conversation_uuid = UUID(conversation_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid conversation ID format")

        db_manager = await get_database_manager()

        async with db_manager.get_session() as session:
            # Check if conversation exists
            stmt = select(ConversationModel).where(ConversationModel.id == conversation_uuid)
            result = await session.execute(stmt)
            db_conversation = result.scalar_one_or_none()

            if not db_conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")

            # TODO: Add user authorization check when authentication is implemented
            # if db_conversation.user_id != current_user.id:
            #     raise HTTPException(status_code=403, detail="Not authorized to delete this conversation")

            # Delete conversation (messages will be cascade deleted)
            await session.delete(db_conversation)
            await session.commit()

            logger.info(f"Deleted conversation {conversation_id}")

            return ApiResponse(
                data={"deleted": True, "conversation_id": conversation_id},
                message="Conversation deleted successfully"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete conversation {conversation_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to delete conversation: {str(e)}"
        )


@router.put("/conversations/{conversation_id}/title", response_model=ApiResponse[dict])
async def update_conversation_title(
    conversation_id: str,
    title: str = Query(..., min_length=1, max_length=255)
) -> ApiResponse[dict]:
    """Update conversation title."""
    try:
        # Validate UUID format
        try:
            conversation_uuid = UUID(conversation_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid conversation ID format")

        db_manager = await get_database_manager()

        async with db_manager.get_session() as session:
            # Get conversation
            stmt = select(ConversationModel).where(ConversationModel.id == conversation_uuid)
            result = await session.execute(stmt)
            db_conversation = result.scalar_one_or_none()

            if not db_conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")

            # TODO: Add user authorization check when authentication is implemented

            # Update title
            db_conversation.title = title.strip()
            await session.commit()

            logger.info(f"Updated conversation {conversation_id} title to '{title}'")

            return ApiResponse(
                data={"conversation_id": conversation_id, "title": title},
                message="Conversation title updated successfully"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update conversation title: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to update conversation title: {str(e)}"
        )


@router.get("/conversations/{conversation_id}/messages", response_model=ApiResponse[list[ChatMessage]])
async def get_conversation_messages(
    conversation_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ApiResponse[list[ChatMessage]]:
    """Get messages from a conversation with pagination."""
    try:
        # Validate UUID format
        try:
            conversation_uuid = UUID(conversation_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid conversation ID format")

        db_manager = await get_database_manager()

        async with db_manager.get_session() as session:
            # Check if conversation exists
            conv_stmt = select(ConversationModel).where(ConversationModel.id == conversation_uuid)
            conv_result = await session.execute(conv_stmt)
            if not conv_result.scalar_one_or_none():
                raise HTTPException(status_code=404, detail="Conversation not found")

            # Get messages with pagination
            stmt = (
                select(MessageModel)
                .where(MessageModel.conversation_id == conversation_uuid)
                .order_by(MessageModel.created_at)
                .limit(limit)
                .offset(offset)
            )
            result = await session.execute(stmt)
            db_messages = result.scalars().all()

            # Convert to API models
            messages = []
            for db_message in db_messages:
                # Parse sources from metadata if available
                sources = []
                if db_message.metadata and "sources" in db_message.metadata:
                    for source_data in db_message.metadata["sources"]:
                        sources.append(RetrievalResult(**source_data))

                message = ChatMessage(
                    id=str(db_message.id),
                    content=db_message.content,
                    role=db_message.role,
                    sources=sources if sources else None,
                    timestamp=db_message.created_at,
                    conversation_id=conversation_id,
                )
                messages.append(message)

            return ApiResponse(
                data=messages,
                message=f"Retrieved {len(messages)} messages"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get conversation messages: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to get conversation messages: {str(e)}"
        )


# Helper functions

async def _generate_response(
    query: str,
    analysis: QueryAnalysis,
    sources: list[RetrievalResult],
) -> str:
    """Generate response based on query analysis and retrieved sources.
    
    Args:
        query: User query
        analysis: Query analysis results
        sources: Retrieved sources
        
    Returns:
        Generated response text
    """
    try:
        # For now, create a structured response based on sources
        # TODO: Integrate with LLM for more sophisticated response generation

        if not sources:
            return f"I couldn't find specific information about '{query}'. Please try rephrasing your question or check if the product name is correct."

        # Group sources by type
        vector_sources = [s for s in sources if s.source == "vector"]
        kg_sources = [s for s in sources if s.source == "kg"]
        hybrid_sources = [s for s in sources if s.source == "hybrid"]

        response_parts = []

        # Add query-type specific introduction
        if analysis.query_type == QueryType.SPECIFICATION:
            response_parts.append("Based on the technical specifications I found:")
        elif analysis.query_type == QueryType.APPLICATION:
            response_parts.append("Here are the applications and uses I found:")
        elif analysis.query_type == QueryType.COMPARISON:
            response_parts.append("Here's a comparison based on available information:")
        elif analysis.query_type == QueryType.RELATIONSHIP:
            response_parts.append("Here are related products and relationships I found:")
        else:
            response_parts.append("Based on the available information:")

        # Add top sources content
        for i, source in enumerate(sources[:3], 1):
            content = source.content.strip()
            if len(content) > 300:
                content = content[:300] + "..."

            source_type = source.source.upper()
            confidence = f"(confidence: {source.score:.2f})"

            response_parts.append(f"\n{i}. {content} {confidence}")

            # Add source attribution
            if source.metadata.get("document"):
                doc_name = source.metadata["document"]
                page = source.metadata.get("page", "")
                page_info = f", page {page}" if page else ""
                response_parts.append(f"   Source: {doc_name}{page_info}")

        # Add summary if multiple sources
        if len(sources) > 3:
            response_parts.append(f"\n...and {len(sources) - 3} additional sources found.")

        # Add entities mentioned
        if analysis.entities:
            entities_str = ", ".join(analysis.entities[:5])
            response_parts.append(f"\nEntities identified: {entities_str}")

        return "\n".join(response_parts)

    except Exception as e:
        logger.error(f"Failed to generate response: {e}")
        return f"I found some information about '{query}', but encountered an error while formatting the response. Please try again."


async def _store_conversation_message(
    conversation_id: str,
    user_message: str,
    assistant_message: str,
    sources: list[RetrievalResult],
    query_analysis: QueryAnalysis,
) -> None:
    """Store conversation messages in database.
    
    Args:
        conversation_id: Conversation ID
        user_message: User's message
        assistant_message: Assistant's response
        sources: Retrieval sources
        query_analysis: Query analysis results
    """
    try:
        conversation_uuid = UUID(conversation_id)
        db_manager = await get_database_manager()

        async with db_manager.get_session() as session:
            # Get or create conversation
            stmt = select(ConversationModel).where(ConversationModel.id == conversation_uuid)
            result = await session.execute(stmt)
            conversation = result.scalar_one_or_none()

            if not conversation:
                # Create new conversation
                conversation = ConversationModel(
                    id=conversation_uuid,
                    title=None,  # Will be set later if needed
                    user_id=None,  # TODO: Set when authentication is implemented
                )
                session.add(conversation)
                await session.flush()  # Get the ID

            # Store user message
            user_msg = MessageModel(
                conversation_id=conversation_uuid,
                role="user",
                content=user_message,
                metadata={
                    "query_analysis": query_analysis.dict(),
                    "timestamp": time.time(),
                }
            )
            session.add(user_msg)

            # Store assistant message with sources
            sources_data = [source.dict() for source in sources] if sources else []
            assistant_msg = MessageModel(
                conversation_id=conversation_uuid,
                role="assistant",
                content=assistant_message,
                metadata={
                    "sources": sources_data,
                    "source_count": len(sources),
                    "kg_enhanced": any(s.source in ["kg", "hybrid"] for s in sources),
                    "timestamp": time.time(),
                }
            )
            session.add(assistant_msg)

            # Update conversation timestamp
            conversation.updated_at = MessageModel.created_at

            await session.commit()

            logger.info(f"Stored conversation messages for {conversation_id}")

    except Exception as e:
        logger.error(f"Failed to store conversation messages: {e}", exc_info=True)
        # Don't raise exception here to avoid breaking the chat flow
