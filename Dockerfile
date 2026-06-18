FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

COPY bin/ /app/bin/
COPY static/ /app/static/
COPY app.py /app/app.py

RUN chmod +x /app/bin/yt-dlp

EXPOSE 8765

# Bind all interfaces inside the container so the published port is reachable; app.py reads HOST from env.
ENV HOST=0.0.0.0

CMD ["python3", "-u", "app.py"]
