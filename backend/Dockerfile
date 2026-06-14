# ============================================================
# Stage 1: Build Rust bindings
# ============================================================
FROM python:3.14-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /build

# Install compilation dependencies and Rust compiler
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libssl-dev \
    pkg-config \
    git \
 && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.cargo/bin:${PATH}"

# Install maturin for PyO3 wheel building
RUN pip install --no-cache-dir maturin

# Copy the Rust codebase
COPY rust /build/rust

# Build the Python wheels of ozy-bindings
WORKDIR /build/rust/ozy-bindings
RUN maturin build --release --out /build/dist

# ============================================================
# Stage 2: Final Runner image
# ============================================================
FROM python:3.14-slim AS runner

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copy the compiled wheel from stage 1
COPY --from=builder /build/dist/*.whl /tmp/

# Copy dependencies list
COPY backend/requirements.txt /app/requirements.txt

# Install dependencies and the compiled Rust bindings wheel
RUN pip install --no-cache-dir -r /app/requirements.txt \
 && pip install --no-cache-dir /tmp/*.whl \
 && rm -rf /tmp/*

# Copy FastAPI backend application files
COPY backend/app /app/app
COPY backend/alembic.ini /app/alembic.ini
COPY backend/alembic /app/alembic

EXPOSE 8000

CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
