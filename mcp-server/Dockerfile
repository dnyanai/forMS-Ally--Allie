FROM python:3.12-slim
# Start with a lightweight Python 3.12 image (Linux + Python pre-installed)

WORKDIR /app
# Create and switch to /app folder inside the container

COPY requirements.txt .
# Copy requirements.txt from your computer → container's /app/

RUN pip install --no-cache-dir -r requirements.txt
# Install Python packages (--no-cache-dir keeps image small)

COPY . .
# Copy everything else from mcp-server/ → container's /app/
# Now container has: server.py, tools/, etc.

ENV PORT=8080
# Set environment variable (Cloud Run uses this)

EXPOSE 8080
# Document which port the app uses (informational)

CMD ["python", "server.py"]
# Command to run when container starts