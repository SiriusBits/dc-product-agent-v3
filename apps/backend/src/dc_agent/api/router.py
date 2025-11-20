from fastapi import APIRouter
from dc_agent.api import health

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
