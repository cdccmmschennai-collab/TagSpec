# TagSpec backend — FastAPI served by uvicorn.
# Build context: ./backend
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install the application and its runtime dependencies from pyproject.
# Copy only what the package needs so the image stays lean.
COPY pyproject.toml ./
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY scripts ./scripts

RUN pip install --upgrade pip && pip install .

# Run as a non-root user and pre-create the storage tree (mounted as a volume).
RUN useradd --create-home appuser \
    && mkdir -p /app/storage/uploads /app/storage/exports \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Migrations are applied at container start (see docker-compose command); the
# default CMD just serves the app so the image is usable standalone too.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
