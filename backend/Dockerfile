# backend/Dockerfile
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies for psycopg2, Pillow, etc.
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libjpeg-dev \
    zlib1g-dev \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy Django project
COPY . .

# Create entrypoint script for better service coordination
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Wait for Redis to be ready\n\
echo "Waiting for Redis..."\n\
while ! nc -z redis 6379; do\n\
  sleep 0.1\n\
done\n\
echo "Redis started"\n\
\n\
# Run migrations\n\
echo "Running migrations..."\n\
python manage.py migrate --noinput\n\
\n\
# Collect static files\n\
echo "Collecting static files..."\n\
python manage.py collectstatic --noinput\n\
\n\
# Execute the main command\n\
exec "$@"' > /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "backend.asgi:application"]