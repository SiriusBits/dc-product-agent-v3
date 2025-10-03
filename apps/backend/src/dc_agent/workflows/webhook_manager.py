"""Webhook management for workflow automation."""

import logging
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

from .n8n_client import N8nClient, WorkflowTrigger

logger = logging.getLogger(__name__)


class WebhookType(Enum):
    """Types of webhook triggers."""
    
    PDF_PROCESSING = "pdf_processing"
    DATA_REFRESH = "data_refresh"
    QUALITY_MONITORING = "quality_monitoring"
    SYSTEM_ALERT = "system_alert"
    BACKUP_TRIGGER = "backup_trigger"


@dataclass
class WebhookConfig:
    """Webhook configuration."""
    
    name: str
    webhook_type: WebhookType
    webhook_path: str
    description: str
    enabled: bool = True
    timeout: int = 300
    retry_count: int = 3
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "name": self.name,
            "webhook_type": self.webhook_type.value,
            "webhook_path": self.webhook_path,
            "description": self.description,
            "enabled": self.enabled,
            "timeout": self.timeout,
            "retry_count": self.retry_count
        }


class WebhookManager:
    """Manages webhook triggers and workflow automation."""
    
    def __init__(self, n8n_client: N8nClient):
        """Initialize webhook manager.
        
        Args:
            n8n_client: n8n client instance
        """
        self.n8n_client = n8n_client
        self.webhooks: Dict[str, WebhookConfig] = {}
        self.event_handlers: Dict[WebhookType, List[Callable]] = {}
        self._initialize_default_webhooks()
    
    def _initialize_default_webhooks(self):
        """Initialize default webhook configurations."""
        default_webhooks = [
            WebhookConfig(
                name="PDF Processing",
                webhook_type=WebhookType.PDF_PROCESSING,
                webhook_path="process-pdf",
                description="Trigger PDF extraction and ingestion workflow",
                timeout=600
            ),
            WebhookConfig(
                name="Data Refresh",
                webhook_type=WebhookType.DATA_REFRESH,
                webhook_path="refresh-data",
                description="Trigger data refresh and reindexing workflow",
                timeout=1800
            ),
            WebhookConfig(
                name="Quality Monitoring",
                webhook_type=WebhookType.QUALITY_MONITORING,
                webhook_path="quality-check",
                description="Trigger data quality monitoring workflow",
                timeout=300
            ),
            WebhookConfig(
                name="System Alert",
                webhook_type=WebhookType.SYSTEM_ALERT,
                webhook_path="system-alert",
                description="Trigger system alert notification workflow",
                timeout=60
            ),
            WebhookConfig(
                name="Backup Trigger",
                webhook_type=WebhookType.BACKUP_TRIGGER,
                webhook_path="backup-data",
                description="Trigger data backup workflow",
                timeout=900
            )
        ]
        
        for webhook in default_webhooks:
            self.webhooks[webhook.name] = webhook
    
    def register_webhook(self, config: WebhookConfig) -> bool:
        """Register a new webhook configuration.
        
        Args:
            config: Webhook configuration
            
        Returns:
            True if registered successfully
        """
        try:
            self.webhooks[config.name] = config
            logger.info(f"Registered webhook: {config.name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to register webhook {config.name}: {e}")
            return False
    
    def unregister_webhook(self, name: str) -> bool:
        """Unregister a webhook configuration.
        
        Args:
            name: Webhook name
            
        Returns:
            True if unregistered successfully
        """
        try:
            if name in self.webhooks:
                del self.webhooks[name]
                logger.info(f"Unregistered webhook: {name}")
                return True
            else:
                logger.warning(f"Webhook not found: {name}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to unregister webhook {name}: {e}")
            return False
    
    def add_event_handler(
        self,
        webhook_type: WebhookType,
        handler: Callable[[Dict[str, Any]], None]
    ):
        """Add an event handler for webhook type.
        
        Args:
            webhook_type: Type of webhook
            handler: Event handler function
        """
        if webhook_type not in self.event_handlers:
            self.event_handlers[webhook_type] = []
        
        self.event_handlers[webhook_type].append(handler)
        logger.info(f"Added event handler for {webhook_type.value}")
    
    async def trigger_pdf_processing(
        self,
        filename: str,
        file_path: str,
        processing_options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Trigger PDF processing workflow.
        
        Args:
            filename: PDF filename
            file_path: Path to PDF file
            processing_options: Optional processing parameters
            
        Returns:
            Workflow execution result
        """
        payload = {
            "filename": filename,
            "file_path": file_path,
            "processing_options": processing_options or {},
            "triggered_by": "api",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return await self._trigger_webhook(
            WebhookType.PDF_PROCESSING,
            payload,
            wait_for_completion=True
        )
    
    async def trigger_data_refresh(
        self,
        refresh_type: str = "incremental",
        force_rebuild: bool = False
    ) -> Dict[str, Any]:
        """Trigger data refresh workflow.
        
        Args:
            refresh_type: Type of refresh ("incremental" or "full")
            force_rebuild: Whether to force complete rebuild
            
        Returns:
            Workflow execution result
        """
        payload = {
            "refresh_type": refresh_type,
            "force_rebuild": force_rebuild,
            "triggered_by": "api",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return await self._trigger_webhook(
            WebhookType.DATA_REFRESH,
            payload,
            wait_for_completion=False  # Long-running workflow
        )
    
    async def trigger_quality_monitoring(
        self,
        check_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Trigger data quality monitoring workflow.
        
        Args:
            check_types: Types of quality checks to perform
            
        Returns:
            Workflow execution result
        """
        payload = {
            "check_types": check_types or ["all"],
            "triggered_by": "api",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return await self._trigger_webhook(
            WebhookType.QUALITY_MONITORING,
            payload,
            wait_for_completion=True
        )
    
    async def trigger_system_alert(
        self,
        alert_type: str,
        message: str,
        severity: str = "medium",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Trigger system alert workflow.
        
        Args:
            alert_type: Type of alert
            message: Alert message
            severity: Alert severity ("low", "medium", "high", "critical")
            metadata: Additional alert metadata
            
        Returns:
            Workflow execution result
        """
        payload = {
            "alert_type": alert_type,
            "message": message,
            "severity": severity,
            "metadata": metadata or {},
            "triggered_by": "api",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return await self._trigger_webhook(
            WebhookType.SYSTEM_ALERT,
            payload,
            wait_for_completion=False
        )
    
    async def trigger_backup(
        self,
        backup_type: str = "incremental",
        include_metadata: bool = True
    ) -> Dict[str, Any]:
        """Trigger backup workflow.
        
        Args:
            backup_type: Type of backup ("incremental" or "full")
            include_metadata: Whether to include metadata
            
        Returns:
            Workflow execution result
        """
        payload = {
            "backup_type": backup_type,
            "include_metadata": include_metadata,
            "triggered_by": "api",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return await self._trigger_webhook(
            WebhookType.BACKUP_TRIGGER,
            payload,
            wait_for_completion=False  # Long-running workflow
        )
    
    async def _trigger_webhook(
        self,
        webhook_type: WebhookType,
        payload: Dict[str, Any],
        wait_for_completion: bool = False
    ) -> Dict[str, Any]:
        """Internal method to trigger webhook.
        
        Args:
            webhook_type: Type of webhook to trigger
            payload: Payload to send
            wait_for_completion: Whether to wait for completion
            
        Returns:
            Webhook execution result
        """
        # Find webhook configuration
        webhook_config = None
        for config in self.webhooks.values():
            if config.webhook_type == webhook_type and config.enabled:
                webhook_config = config
                break
        
        if not webhook_config:
            return {
                "success": False,
                "error": f"No enabled webhook found for type: {webhook_type.value}"
            }
        
        try:
            # Call event handlers
            if webhook_type in self.event_handlers:
                for handler in self.event_handlers[webhook_type]:
                    try:
                        handler(payload)
                    except Exception as e:
                        logger.error(f"Event handler error for {webhook_type.value}: {e}")
            
            # Trigger webhook with retry logic
            result = None
            last_error = None
            
            for attempt in range(webhook_config.retry_count):
                try:
                    result = await self.n8n_client.trigger_webhook(
                        webhook_config.webhook_path,
                        payload,
                        wait_for_completion=wait_for_completion,
                        timeout=webhook_config.timeout
                    )
                    
                    if result.get("success", False):
                        break
                    else:
                        last_error = result.get("error", "Unknown error")
                        
                except Exception as e:
                    last_error = str(e)
                    logger.warning(f"Webhook attempt {attempt + 1} failed: {e}")
                
                # Wait before retry (exponential backoff)
                if attempt < webhook_config.retry_count - 1:
                    import asyncio
                    await asyncio.sleep(2 ** attempt)
            
            if not result or not result.get("success", False):
                return {
                    "success": False,
                    "error": f"Webhook failed after {webhook_config.retry_count} attempts: {last_error}",
                    "webhook_type": webhook_type.value,
                    "webhook_path": webhook_config.webhook_path
                }
            
            return {
                **result,
                "webhook_type": webhook_type.value,
                "webhook_config": webhook_config.name
            }
            
        except Exception as e:
            logger.error(f"Failed to trigger webhook {webhook_type.value}: {e}")
            return {
                "success": False,
                "error": str(e),
                "webhook_type": webhook_type.value
            }
    
    def get_webhook_configs(self) -> List[Dict[str, Any]]:
        """Get all webhook configurations.
        
        Returns:
            List of webhook configurations
        """
        return [config.to_dict() for config in self.webhooks.values()]
    
    def get_webhook_config(self, name: str) -> Optional[Dict[str, Any]]:
        """Get specific webhook configuration.
        
        Args:
            name: Webhook name
            
        Returns:
            Webhook configuration or None
        """
        config = self.webhooks.get(name)
        return config.to_dict() if config else None
    
    def enable_webhook(self, name: str) -> bool:
        """Enable a webhook.
        
        Args:
            name: Webhook name
            
        Returns:
            True if enabled successfully
        """
        if name in self.webhooks:
            self.webhooks[name].enabled = True
            logger.info(f"Enabled webhook: {name}")
            return True
        return False
    
    def disable_webhook(self, name: str) -> bool:
        """Disable a webhook.
        
        Args:
            name: Webhook name
            
        Returns:
            True if disabled successfully
        """
        if name in self.webhooks:
            self.webhooks[name].enabled = False
            logger.info(f"Disabled webhook: {name}")
            return True
        return False
    
    async def health_check(self) -> Dict[str, Any]:
        """Check webhook manager and n8n health.
        
        Returns:
            Health status information
        """
        try:
            # Check n8n health
            n8n_health = await self.n8n_client.health_check()
            
            # Count enabled/disabled webhooks
            enabled_count = sum(1 for config in self.webhooks.values() if config.enabled)
            disabled_count = len(self.webhooks) - enabled_count
            
            return {
                "status": "healthy" if n8n_health["status"] == "healthy" else "unhealthy",
                "n8n_status": n8n_health,
                "webhook_manager": {
                    "total_webhooks": len(self.webhooks),
                    "enabled_webhooks": enabled_count,
                    "disabled_webhooks": disabled_count,
                    "event_handlers": {
                        webhook_type.value: len(handlers)
                        for webhook_type, handlers in self.event_handlers.items()
                    }
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Webhook manager health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }