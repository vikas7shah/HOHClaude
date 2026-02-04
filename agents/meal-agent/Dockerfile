# HOH Meal Agent - Docker image for Bedrock AgentCore Runtime
# Based on the Strands Agents recommended Python base image

FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Expose port for local testing (optional)
EXPOSE 8080

# Default command for AgentCore Runtime
CMD ["python", "-m", "handler"]
