FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    RUNTIME_DIR=/tmp/resume-tailor

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        texlive-fonts-recommended \
        texlive-latex-base \
        texlive-latex-extra \
        texlive-latex-recommended \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.prod.txt ./requirements.prod.txt
RUN pip install --upgrade pip \
    && pip install -r requirements.prod.txt

COPY backend/ ./
RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && mkdir -p "${RUNTIME_DIR}" \
    && chown -R appuser:appuser /app "${RUNTIME_DIR}"

USER appuser
EXPOSE 10000

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000} --proxy-headers --forwarded-allow-ips='*'"]
