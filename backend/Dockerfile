# Use Python 3.11 slim as base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY . .

# Set environment variables for simulation logic
ENV PYTHONUNBUFFERED=1

# Run the server from the backend/backend/ directory
# Use the module path for uvicorn
CMD ["sh", "-c", "uvicorn backend.server:app --host 0.0.0.0 --port $PORT"]
