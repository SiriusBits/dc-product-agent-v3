FROM python:3.11-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy configuration
COPY pyproject.toml .

# Create virtual environment and install dependencies
RUN uv venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN uv pip install -e .

# Copy source code
COPY src src

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "src.dc_agent.main:app", "--host", "0.0.0.0", "--port", "8000"]
