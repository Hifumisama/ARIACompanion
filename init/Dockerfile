FROM python:3.11-slim

RUN pip install --no-cache-dir huggingface_hub

WORKDIR /app
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
