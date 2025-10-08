"""Enhanced workflow automation service for data ingestion and quality monitoring."""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from ..workflows.n8n_client import N8nClient
from ..workflows.webhook_manager import WebhookManager, WebhookType
from .ingestion_service import IngestionService
from .kg_ingestion_service import KGIngestionService

logger = logging.getLogger(__name__)


class WorkflowAutomationService:
    """Service for automated workflow orchestration and data processing."""

    def __init__(
        self,
        webhook_manager: WebhookManager,
        ingestion_service: IngestionService,
        kg_ingestion_service: Optional[KGIngestionService] = None,
    ):
        """Initialize workflow automation service.
        
        Args:
            webhook_manager: Webhook manager instance
            ingestion_service: Document ingestion service
            kg_ingestion_service: Knowledge graph ingestion service
        """
        self.webhook_manager = webhook_manager
        self.ingestion_service = ingestion_service
        self.kg_ingestion_service = kg_ingestion_service
        
        # Automation statistics
        self._automation_stats = {
            "workflows_triggered": 0,
            "successful_workflows": 0,
            "failed_workflows": 0,
            "documents_processed": 0,
            "batches_processed": 0,
            "quality_checks_performed": 0,
            "last_activity": None,
        }
        
        # Setup enhanced webhook handlers
        self._setup_enhanced_handlers()

    def _setup_enhanced_handlers(self):
        """Setup enhanced webhook event handlers."""
        # Document processing completion handler
        self.webhook_manager.add_event_handler(
            WebhookType.PDF_PROCESSING,
            self._handle_document_processing_event
        )
        
        # Quality monitoring handler
        self.webhook_manager.add_event_handler(
            WebhookType.QUALITY_MONITORING,
            self._handle_quality_monitoring_event
        )
        
        # System alert handler
        self.webhook_manager.add_event_handler(
            WebhookType.SYSTEM_ALERT,
            self._handle_system_alert_event
        )

    async def process_document_with_workflow(
        self,
        filename: Optional[str] = None,
        document_data: Optional[Dict[str, Any]] = None,
        file_path: Optional[str] = None,
        processing_options: Optional[Dict[str, Any]] = None,
        use_workflow: bool = True,
    ) -> Dict[str, Any]:
        """Process document using either workflow automation or direct processing.
        
        Args:
            filename: PDF filename
            document_data: Pre-extracted document data
            file_path: Path to PDF file
            processing_options: Processing configuration options
            use_workflow: Whether to use n8n workflow or direct processing
            
        Returns:
            Processing result
        """
        try:
            self._automation_stats["workflows_triggered"] += 1
            self._automation_stats["last_activity"] = datetime.utcnow().isoformat()
            
            if use_workflow:
                # Use n8n workflow for processing
                result = await self._process_via_workflow(
                    filename=filename,
                    document_data=document_data,
                    file_path=file_path,
                    processing_options=processing_options,
                )
            else:
                # Direct processing without workflow
                result = await self._process_directly(
                    filename=filename,
                    document_data=document_data,
                    file_path=file_path,
                    processing_options=processing_options,
                )
            
            if result.get("success", False):
                self._automation_stats["successful_workflows"] += 1
                self._automation_stats["documents_processed"] += 1
            else:
                self._automation_stats["failed_workflows"] += 1
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to process document with workflow: {e}")
            self._automation_stats["failed_workflows"] += 1
            return {
                "success": False,
                "error": str(e),
                "processing_method": "workflow" if use_workflow else "direct",
            }

    async def process_batch_with_workflow(
        self,
        documents: List[Dict[str, Any]],
        processing_options: Optional[Dict[str, Any]] = None,
        use_workflow: bool = True,
        max_concurrent: int = 3,
    ) -> Dict[str, Any]:
        """Process batch of documents using workflow automation.
        
        Args:
            documents: List of documents to process
            processing_options: Processing configuration options
            use_workflow: Whether to use n8n workflow or direct processing
            max_concurrent: Maximum concurrent processing (for direct processing)
            
        Returns:
            Batch processing result
        """
        try:
            self._automation_stats["workflows_triggered"] += 1
            self._automation_stats["batches_processed"] += 1
            self._automation_stats["last_activity"] = datetime.utcnow().isoformat()
            
            if use_workflow:
                # Use n8n batch workflow
                result = await self._process_batch_via_workflow(
                    documents=documents,
                    processing_options=processing_options,
                )
            else:
                # Direct batch processing with concurrency control
                result = await self._process_batch_directly(
                    documents=documents,
                    processing_options=processing_options,
                    max_concurrent=max_concurrent,
                )
            
            if result.get("success", False):
                self._automation_stats["successful_workflows"] += 1
                self._automation_stats["documents_processed"] += len(documents)
            else:
                self._automation_stats["failed_workflows"] += 1
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to process batch with workflow: {e}")
            self._automation_stats["failed_workflows"] += 1
            return {
                "success": False,
                "error": str(e),
                "processing_method": "workflow" if use_workflow else "direct",
                "document_count": len(documents),
            }

    async def trigger_quality_monitoring(
        self,
        check_types: Optional[List[str]] = None,
        use_workflow: bool = True,
    ) -> Dict[str, Any]:
        """Trigger data quality monitoring.
        
        Args:
            check_types: Types of quality checks to perform
            use_workflow: Whether to use n8n workflow
            
        Returns:
            Quality monitoring result
        """
        try:
            self._automation_stats["workflows_triggered"] += 1
            self._automation_stats["quality_checks_performed"] += 1
            self._automation_stats["last_activity"] = datetime.utcnow().isoformat()
            
            if use_workflow:
                # Use n8n quality monitoring workflow
                result = await self.webhook_manager.trigger_quality_monitoring(
                    check_types=check_types
                )
            else:
                # Direct quality monitoring
                result = await self._perform_quality_checks_directly(check_types)
            
            if result.get("success", False):
                self._automation_stats["successful_workflows"] += 1
            else:
                self._automation_stats["failed_workflows"] += 1
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to trigger quality monitoring: {e}")
            self._automation_stats["failed_workflows"] += 1
            return {
                "success": False,
                "error": str(e),
                "processing_method": "workflow" if use_workflow else "direct",
            }

    async def schedule_automated_tasks(
        self,
        enable_quality_monitoring: bool = True,
        quality_check_interval_hours: int = 4,
        enable_data_refresh: bool = False,
        data_refresh_interval_hours: int = 24,
    ) -> Dict[str, Any]:
        """Schedule automated background tasks.
        
        Args:
            enable_quality_monitoring: Whether to enable automated quality monitoring
            quality_check_interval_hours: Interval for quality checks in hours
            enable_data_refresh: Whether to enable automated data refresh
            data_refresh_interval_hours: Interval for data refresh in hours
            
        Returns:
            Scheduling result
        """
        try:
            scheduled_tasks = []
            
            if enable_quality_monitoring:
                # Schedule quality monitoring
                task_info = {
                    "task_type": "quality_monitoring",
                    "interval_hours": quality_check_interval_hours,
                    "next_run": (datetime.utcnow() + timedelta(hours=quality_check_interval_hours)).isoformat(),
                    "enabled": True,
                }
                scheduled_tasks.append(task_info)
                
                # Start background task for quality monitoring
                asyncio.create_task(
                    self._automated_quality_monitoring_loop(quality_check_interval_hours)
                )
            
            if enable_data_refresh:
                # Schedule data refresh
                task_info = {
                    "task_type": "data_refresh",
                    "interval_hours": data_refresh_interval_hours,
                    "next_run": (datetime.utcnow() + timedelta(hours=data_refresh_interval_hours)).isoformat(),
                    "enabled": True,
                }
                scheduled_tasks.append(task_info)
                
                # Start background task for data refresh
                asyncio.create_task(
                    self._automated_data_refresh_loop(data_refresh_interval_hours)
                )
            
            logger.info(f"Scheduled {len(scheduled_tasks)} automated tasks")
            
            return {
                "success": True,
                "scheduled_tasks": scheduled_tasks,
                "total_tasks": len(scheduled_tasks),
                "timestamp": datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Failed to schedule automated tasks: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def _process_via_workflow(
        self,
        filename: Optional[str] = None,
        document_data: Optional[Dict[str, Any]] = None,
        file_path: Optional[str] = None,
        processing_options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Process document via n8n workflow."""
        # Prepare enhanced processing options
        enhanced_options = {
            "chunking_strategy": "semantic",
            "chunk_size": 1000,
            "chunk_overlap": 200,
            "generate_embeddings": True,
            "ingest_to_vector": True,
            "ingest_to_kg": True,
            "collection_name": "technical_bulletins",
            "overwrite": False,
        }
        
        if processing_options:
            enhanced_options.update(processing_options)
        
        # Trigger workflow via webhook manager
        if filename or file_path:
            return await self.webhook_manager.trigger_pdf_processing(
                filename=filename or "",
                file_path=file_path or "",
                processing_options=enhanced_options,
            )
        else:
            # For pre-extracted documents, use direct processing
            return await self._process_directly(
                document_data=document_data,
                processing_options=enhanced_options,
            )

    async def _process_directly(
        self,
        filename: Optional[str] = None,
        document_data: Optional[Dict[str, Any]] = None,
        file_path: Optional[str] = None,
        processing_options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Process document directly without workflow."""
        if not document_data:
            return {
                "success": False,
                "error": "Direct processing requires document_data",
            }
        
        # Convert document_data to BaseExtractionDocument
        from ..models.product_models import BaseExtractionDocument
        
        try:
            document = BaseExtractionDocument(**document_data)
            
            # Process with ingestion service
            result = await self.ingestion_service.ingest_extraction_document(
                document=document,
                collection_name=processing_options.get("collection_name", "technical_bulletins"),
                overwrite=processing_options.get("overwrite", False),
                chunking_strategy=processing_options.get("chunking_strategy", "semantic"),
                chunk_size=processing_options.get("chunk_size", 1000),
                chunk_overlap=processing_options.get("chunk_overlap", 200),
                generate_embeddings=processing_options.get("generate_embeddings", True),
                ingest_to_kg=processing_options.get("ingest_to_kg", True),
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Direct processing failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "processing_method": "direct",
            }

    async def _process_batch_via_workflow(
        self,
        documents: List[Dict[str, Any]],
        processing_options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Process batch via n8n workflow."""
        # Enhanced batch processing options
        enhanced_options = {
            "chunking_strategy": "semantic",
            "chunk_size": 1000,
            "chunk_overlap": 200,
            "generate_embeddings": True,
            "ingest_to_vector": True,
            "ingest_to_kg": True,
            "collection_name": "technical_bulletins",
            "overwrite": False,
            "continue_on_error": True,
            "max_concurrent": 3,
        }
        
        if processing_options:
            enhanced_options.update(processing_options)
        
        # Use webhook manager to trigger batch workflow
        # Note: This would require implementing batch processing in webhook manager
        # For now, fall back to direct processing
        return await self._process_batch_directly(
            documents=documents,
            processing_options=enhanced_options,
            max_concurrent=enhanced_options.get("max_concurrent", 3),
        )

    async def _process_batch_directly(
        self,
        documents: List[Dict[str, Any]],
        processing_options: Optional[Dict[str, Any]] = None,
        max_concurrent: int = 3,
    ) -> Dict[str, Any]:
        """Process batch directly with concurrency control."""
        from ..models.product_models import BaseExtractionDocument
        
        try:
            # Convert documents to BaseExtractionDocument objects
            doc_objects = []
            for doc_data in documents:
                try:
                    doc_obj = BaseExtractionDocument(**doc_data)
                    doc_objects.append(doc_obj)
                except Exception as e:
                    logger.error(f"Failed to parse document: {e}")
            
            if not doc_objects:
                return {
                    "success": False,
                    "error": "No valid documents to process",
                    "total_documents": len(documents),
                }
            
            # Use ingestion service batch processing
            result = await self.ingestion_service.batch_ingest_documents(
                documents=doc_objects,
                collection_name=processing_options.get("collection_name", "technical_bulletins"),
                overwrite=processing_options.get("overwrite", False),
                continue_on_error=processing_options.get("continue_on_error", True),
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Direct batch processing failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "processing_method": "direct_batch",
                "total_documents": len(documents),
            }

    async def _perform_quality_checks_directly(
        self, check_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Perform quality checks directly without workflow."""
        try:
            # Get system health information
            vector_health = await self.ingestion_service.vector_service.health_check()
            
            kg_health = {}
            if self.kg_ingestion_service:
                kg_stats = await self.kg_ingestion_service.get_ingestion_statistics()
                kg_health = {
                    "status": kg_stats.get("ingestion_service_status", "unknown"),
                    "total_entities": kg_stats.get("total_entities", 0),
                    "total_relationships": kg_stats.get("total_relationships", 0),
                }
            
            # Get ingestion statistics
            ingestion_stats = await self.ingestion_service.get_ingestion_stats()
            
            # Analyze quality
            quality_report = {
                "report_id": f"direct_quality_{int(datetime.utcnow().timestamp())}",
                "timestamp": datetime.utcnow().isoformat(),
                "check_types": check_types or ["system_health", "data_completeness"],
                "system_health": {
                    "vector_db": vector_health,
                    "knowledge_graph": kg_health,
                },
                "data_quality": {
                    "ingestion_stats": ingestion_stats,
                },
                "alerts": [],
                "overall_status": "healthy",
            }
            
            # Check for issues
            if vector_health.get("status") != "healthy":
                quality_report["alerts"].append({
                    "severity": "error",
                    "component": "vector_db",
                    "message": "Vector database health check failed",
                })
                quality_report["overall_status"] = "degraded"
            
            if kg_health.get("status") != "healthy":
                quality_report["alerts"].append({
                    "severity": "warning",
                    "component": "knowledge_graph",
                    "message": "Knowledge graph service not healthy",
                })
                if quality_report["overall_status"] == "healthy":
                    quality_report["overall_status"] = "degraded"
            
            return {
                "success": True,
                "quality_report": quality_report,
                "processing_method": "direct",
            }
            
        except Exception as e:
            logger.error(f"Direct quality check failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "processing_method": "direct",
            }

    async def _automated_quality_monitoring_loop(self, interval_hours: int):
        """Background loop for automated quality monitoring."""
        while True:
            try:
                await asyncio.sleep(interval_hours * 3600)  # Convert hours to seconds
                
                logger.info("Running automated quality monitoring")
                result = await self.trigger_quality_monitoring(use_workflow=True)
                
                if result.get("success"):
                    logger.info("Automated quality monitoring completed successfully")
                else:
                    logger.error(f"Automated quality monitoring failed: {result.get('error')}")
                    
            except asyncio.CancelledError:
                logger.info("Automated quality monitoring loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in automated quality monitoring loop: {e}")

    async def _automated_data_refresh_loop(self, interval_hours: int):
        """Background loop for automated data refresh."""
        while True:
            try:
                await asyncio.sleep(interval_hours * 3600)  # Convert hours to seconds
                
                logger.info("Running automated data refresh")
                result = await self.webhook_manager.trigger_data_refresh(
                    refresh_type="incremental",
                    force_rebuild=False,
                )
                
                if result.get("success"):
                    logger.info("Automated data refresh completed successfully")
                else:
                    logger.error(f"Automated data refresh failed: {result.get('error')}")
                    
            except asyncio.CancelledError:
                logger.info("Automated data refresh loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in automated data refresh loop: {e}")

    def _handle_document_processing_event(self, payload: Dict[str, Any]):
        """Handle document processing event."""
        logger.info(f"Document processing event: {payload.get('filename', 'unknown')}")

    def _handle_quality_monitoring_event(self, payload: Dict[str, Any]):
        """Handle quality monitoring event."""
        logger.info("Quality monitoring event triggered")

    def _handle_system_alert_event(self, payload: Dict[str, Any]):
        """Handle system alert event."""
        alert_type = payload.get("alert_type", "unknown")
        severity = payload.get("severity", "medium")
        logger.warning(f"System alert event: {alert_type} (severity: {severity})")

    async def get_automation_statistics(self) -> Dict[str, Any]:
        """Get workflow automation statistics.
        
        Returns:
            Automation statistics
        """
        return {
            **self._automation_stats,
            "success_rate": (
                self._automation_stats["successful_workflows"] / 
                max(1, self._automation_stats["workflows_triggered"])
            ),
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def health_check(self) -> Dict[str, Any]:
        """Check workflow automation service health.
        
        Returns:
            Health status information
        """
        try:
            # Check webhook manager health
            webhook_health = await self.webhook_manager.health_check()
            
            # Check ingestion service health
            ingestion_health = await self.ingestion_service.vector_service.health_check()
            
            # Check KG ingestion service health if available
            kg_health = {"status": "not_configured"}
            if self.kg_ingestion_service:
                kg_stats = await self.kg_ingestion_service.get_ingestion_statistics()
                kg_health = {
                    "status": kg_stats.get("ingestion_service_status", "unknown"),
                }
            
            overall_status = "healthy"
            if (webhook_health.get("status") != "healthy" or 
                ingestion_health.get("status") != "healthy"):
                overall_status = "degraded"
            
            return {
                "status": overall_status,
                "webhook_manager": webhook_health,
                "ingestion_service": ingestion_health,
                "kg_ingestion_service": kg_health,
                "automation_stats": self._automation_stats,
                "timestamp": datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Workflow automation health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }