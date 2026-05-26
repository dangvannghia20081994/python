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

# app.py binds 127.0.0.1 — override to 0.0.0.0 inside container via sed at runtime
RUN sed -i 's/"127.0.0.1"/"0.0.0.0"/' /app/app.py

CMD ["python3", "-u", "app.py"]
