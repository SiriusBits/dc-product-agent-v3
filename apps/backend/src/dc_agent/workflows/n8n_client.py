"""n8n workflow automation client."""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any

import aiohttp
from aiohttp import BasicAuth

logger = logging.getLogger(__name__)


class WorkflowStatus(Enum):
    """Workflow execution status."""

    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
    WAITING = "waiting"
    CANCELED = "canceled"


@dataclass
class WorkflowTrigger:
    """Represents a workflow trigger event."""

    workflow_name: str
    webhook_path: str
    payload: dict[str, Any]
    trigger_type: str = "webhook"
    priority: str = "normal"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API calls."""
        return {
            "workflow_name": self.workflow_name,
            "webhook_path": self.webhook_path,
            "payload": self.payload,
            "trigger_type": self.trigger_type,
            "priority": self.priority,
            "timestamp": datetime.utcnow().isoformat(),
        }


@dataclass
class WorkflowExecution:
    """Represents a workflow execution result."""

    execution_id: str
    workflow_name: str
    status: WorkflowStatus
    start_time: datetime
    end_time: datetime | None = None
    result: dict[str, Any] | None = None
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "execution_id": self.execution_id,
            "workflow_name": self.workflow_name,
            "status": self.status.value,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "result": self.result,
            "error": self.error,
        }


class N8nClient:
    """Client for interacting with n8n workflow automation."""

    def __init__(
        self,
        base_url: str = "http://localhost:5678",
        username: str = "admin",
        password: str = "admin123",
        timeout: int = 30,
    ):
        """Initialize n8n client.

        Args:
            base_url: n8n server base URL
            username: Basic auth username
            password: Basic auth password
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip("/")
        self.auth = BasicAuth(username, password)
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self.session: aiohttp.ClientSession | None = None

    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession(auth=self.auth, timeout=self.timeout)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()

    async def _ensure_session(self):
        """Ensure session is available."""
        if not self.session:
            self.session = aiohttp.ClientSession(auth=self.auth, timeout=self.timeout)

    async def health_check(self) -> dict[str, Any]:
        """Check n8n health status.

        Returns:
            Health status information
        """
        try:
            await self._ensure_session()

            async with self.session.get(f"{self.base_url}/healthz") as response:
                if response.status == 200:
                    return {
                        "status": "healthy",
                        "service": "n8n",
                        "url": self.base_url,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                else:
                    return {
                        "status": "unhealthy",
                        "service": "n8n",
                        "error": f"HTTP {response.status}",
                        "url": self.base_url,
                        "timestamp": datetime.utcnow().isoformat(),
                    }

        except Exception as e:
            logger.error(f"n8n health check failed: {e}")
            return {
                "status": "unhealthy",
                "service": "n8n",
                "error": str(e),
                "url": self.base_url,
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def trigger_webhook(
        self,
        webhook_path: str,
        payload: dict[str, Any],
        wait_for_completion: bool = False,
        timeout: int = 300,
    ) -> dict[str, Any]:
        """Trigger a webhook workflow.

        Args:
            webhook_path: Webhook path (e.g., "process-pdf")
            payload: Payload to send to webhook
            wait_for_completion: Whether to wait for workflow completion
            timeout: Timeout for waiting (seconds)

        Returns:
            Webhook response or execution result
        """
        try:
            await self._ensure_session()

            webhook_url = f"{self.base_url}/webhook/{webhook_path}"

            async with self.session.post(webhook_url, json=payload) as response:
                if response.status in [200, 201]:
                    result = await response.json()

                    if wait_for_completion and "execution_id" in result:
                        # Wait for workflow completion
                        return await self.wait_for_execution(
                            result["execution_id"], timeout
                        )

                    return {
                        "success": True,
                        "status": response.status,
                        "result": result,
                        "webhook_path": webhook_path,
                    }
                else:
                    error_text = await response.text()
                    return {
                        "success": False,
                        "status": response.status,
                        "error": error_text,
                        "webhook_path": webhook_path,
                    }

        except Exception as e:
            logger.error(f"Failed to trigger webhook {webhook_path}: {e}")
            return {"success": False, "error": str(e), "webhook_path": webhook_path}

    async def get_workflows(self) -> list[dict[str, Any]]:
        """Get list of available workflows.

        Returns:
            List of workflow information
        """
        try:
            await self._ensure_session()

            async with self.session.get(
                f"{self.base_url}/api/v1/workflows"
            ) as response:
                if response.status == 200:
                    workflows = await response.json()
                    return workflows.get("data", [])
                else:
                    logger.error(f"Failed to get workflows: HTTP {response.status}")
                    return []

        except Exception as e:
            logger.error(f"Failed to get workflows: {e}")
            return []

    async def get_workflow_executions(
        self, workflow_id: str, limit: int = 20
    ) -> list[dict[str, Any]]:
        """Get workflow execution history.

        Args:
            workflow_id: Workflow ID
            limit: Maximum number of executions to return

        Returns:
            List of execution information
        """
        try:
            await self._ensure_session()

            params = {"limit": limit}
            url = f"{self.base_url}/api/v1/executions"

            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    executions = await response.json()
                    # Filter by workflow ID
                    filtered = [
                        exec
                        for exec in executions.get("data", [])
                        if exec.get("workflowId") == workflow_id
                    ]
                    return filtered
                else:
                    logger.error(f"Failed to get executions: HTTP {response.status}")
                    return []

        except Exception as e:
            logger.error(f"Failed to get workflow executions: {e}")
            return []

    async def wait_for_execution(
        self, execution_id: str, timeout: int = 300, poll_interval: int = 5
    ) -> dict[str, Any]:
        """Wait for workflow execution to complete.

        Args:
            execution_id: Execution ID to wait for
            timeout: Maximum time to wait (seconds)
            poll_interval: Polling interval (seconds)

        Returns:
            Execution result
        """
        start_time = datetime.utcnow()

        while (datetime.utcnow() - start_time).total_seconds() < timeout:
            try:
                await self._ensure_session()

                url = f"{self.base_url}/api/v1/executions/{execution_id}"
                async with self.session.get(url) as response:
                    if response.status == 200:
                        execution = await response.json()
                        status = execution.get("finished", False)

                        if status:
                            return {
                                "success": not execution.get("stoppedAt"),
                                "execution": execution,
                                "execution_id": execution_id,
                            }

                # Wait before next poll
                await asyncio.sleep(poll_interval)

            except Exception as e:
                logger.error(f"Error polling execution {execution_id}: {e}")
                await asyncio.sleep(poll_interval)

        # Timeout reached
        return {
            "success": False,
            "error": "Execution timeout",
            "execution_id": execution_id,
            "timeout": timeout,
        }

    async def cancel_execution(self, execution_id: str) -> bool:
        """Cancel a running workflow execution.

        Args:
            execution_id: Execution ID to cancel

        Returns:
            True if canceled successfully
        """
        try:
            await self._ensure_session()

            url = f"{self.base_url}/api/v1/executions/{execution_id}/stop"
            async with self.session.post(url) as response:
                return response.status == 200

        except Exception as e:
            logger.error(f"Failed to cancel execution {execution_id}: {e}")
            return False

    async def get_execution_logs(self, execution_id: str) -> list[dict[str, Any]]:
        """Get execution logs.

        Args:
            execution_id: Execution ID

        Returns:
            List of log entries
        """
        try:
            await self._ensure_session()

            url = f"{self.base_url}/api/v1/executions/{execution_id}"
            async with self.session.get(url) as response:
                if response.status == 200:
                    execution = await response.json()

                    # Extract logs from execution data
                    logs = []
                    execution_data = execution.get("data", {})

                    if "resultData" in execution_data:
                        result_data = execution_data["resultData"]
                        if "runData" in result_data:
                            for node_name, node_data in result_data["runData"].items():
                                for run in node_data:
                                    if "error" in run:
                                        logs.append(
                                            {
                                                "level": "error",
                                                "node": node_name,
                                                "message": run["error"].get(
                                                    "message", "Unknown error"
                                                ),
                                                "timestamp": run.get("startTime"),
                                            }
                                        )

                    return logs
                else:
                    logger.error(
                        f"Failed to get execution logs: HTTP {response.status}"
                    )
                    return []

        except Exception as e:
            logger.error(f"Failed to get execution logs: {e}")
            return []

    async def close(self):
        """Close the client session."""
        if self.session:
            await self.session.close()
            self.session = None
