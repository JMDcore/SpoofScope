FROM python:3.13-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app
COPY pyproject.toml ./
COPY spoofscope ./spoofscope
RUN python -m pip install --no-cache-dir --upgrade "pip>=26.2" && pip install --no-cache-dir .
USER root
RUN playwright install --with-deps chromium
RUN mkdir -p /app/data/screenshots && chown -R app:app /app/data
COPY alembic.ini ./alembic.ini
COPY migrations ./migrations
COPY scripts ./scripts
USER app
EXPOSE 8000
CMD ["uvicorn", "spoofscope.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
