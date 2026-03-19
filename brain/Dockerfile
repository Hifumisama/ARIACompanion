FROM ghcr.io/ggerganov/llama.cpp:server

COPY prompts/ /prompts/
COPY entrypoint.sh /entrypoint.sh

USER root
RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
