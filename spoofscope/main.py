import logging
import secrets
import shutil
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from sqlalchemy import delete, desc, func, select
from sqlalchemy.orm import Session

from .config import settings
from .db import Base, engine, get_db
from .logging_config import configure_logging
from .models import Asset, Candidate, Domain, Event, Scan, ScanStatus, Snapshot
from .schemas import DomainCreate, DomainOut, ScanOut
from .services import run_scan_async

logger = logging.getLogger("spoofscope.api")
request_windows: dict[str, deque] = defaultdict(deque)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    configure_logging(settings.log_level)
    yield


app = FastAPI(
    title="SpoofScope API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "X-SpoofScope-Key", "X-Request-ID"],
)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        routes=app.routes,
        description="Defensive domain exposure and impersonation monitoring API.",
    )
    schema.setdefault("components", {}).setdefault("securitySchemes", {})["ApiKey"] = {
        "type": "apiKey",
        "in": "header",
        "name": "X-SpoofScope-Key",
    }
    for path, operations in schema.get("paths", {}).items():
        if path == "/api/health":
            continue
        for operation in operations.values():
            if isinstance(operation, dict):
                operation["security"] = [{"ApiKey": []}]
    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))[:80]
    started = time.monotonic()
    path = request.url.path
    if settings.api_key and path.startswith("/api/") and path != "/api/health":
        supplied = request.headers.get("X-SpoofScope-Key", "")
        if not secrets.compare_digest(supplied, settings.api_key):
            return JSONResponse(
                {"detail": "Authentication required"},
                status_code=401,
                headers={"X-Request-ID": request_id},
            )
    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    window = request_windows[client]
    while window and window[0] < now - 60:
        window.popleft()
    if len(window) >= 120:
        return JSONResponse(
            {"detail": "Rate limit exceeded"},
            status_code=429,
            headers={"Retry-After": "60", "X-Request-ID": request_id},
        )
    window.append(now)
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("unhandled_request_error", extra={"request_id": request_id, "path": path})
        return JSONResponse(
            {"detail": "Internal server error", "request_id": request_id}, status_code=500
        )
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    logger.info(
        "request",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": path,
            "status": response.status_code,
            "duration_ms": round((time.monotonic() - started) * 1000, 1),
        },
    )
    return response


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    db.execute(select(1))
    return {
        "status": "ok",
        "version": app.version,
        "database": "ok",
        "authentication_required": bool(settings.api_key),
    }


@app.get("/api/metrics", response_class=PlainTextResponse)
def metrics(db: Session = Depends(get_db)):
    statuses = {
        scan_status.value: db.scalar(select(func.count(Scan.id)).where(Scan.status == scan_status))
        or 0
        for scan_status in ScanStatus
    }
    lines = [
        "# HELP spoofscope_domains_total Number of configured domains",
        "# TYPE spoofscope_domains_total gauge",
        f"spoofscope_domains_total {db.scalar(select(func.count(Domain.id))) or 0}",
        "# HELP spoofscope_snapshots_total Retained immutable snapshots",
        "# TYPE spoofscope_snapshots_total gauge",
        f"spoofscope_snapshots_total {db.scalar(select(func.count(Snapshot.id))) or 0}",
        "# HELP spoofscope_scans_total Scan runs by status",
        "# TYPE spoofscope_scans_total gauge",
    ]
    lines.extend(
        f'spoofscope_scans_total{{status="{name}"}} {count}' for name, count in statuses.items()
    )
    return "\n".join(lines) + "\n"


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    return {
        "counts": {
            "domains": db.scalar(select(func.count(Domain.id))) or 0,
            "assets": db.scalar(select(func.count(Asset.id)).where(Asset.state != "DISAPPEARED"))
            or 0,
            "candidates": db.scalar(
                select(func.count(Candidate.id)).where(Candidate.state != "DISAPPEARED")
            )
            or 0,
            "events": db.scalar(select(func.count(Event.id))) or 0,
        },
        "events": [
            event_dict(item)
            for item in db.scalars(select(Event).order_by(desc(Event.created_at)).limit(12))
        ],
        "scans": [
            scan_dict(item) for item in db.scalars(select(Scan).order_by(desc(Scan.id)).limit(8))
        ],
    }


@app.get("/api/domains", response_model=list[DomainOut])
def domains(db: Session = Depends(get_db)):
    return db.scalars(select(Domain).order_by(Domain.name)).all()


@app.post("/api/domains", response_model=DomainOut, status_code=status.HTTP_201_CREATED)
def create_domain(payload: DomainCreate, db: Session = Depends(get_db)):
    if not payload.authorized:
        raise HTTPException(422, "You must confirm authorization to monitor this domain")
    if db.scalar(select(Domain).where(Domain.name == payload.name)):
        raise HTTPException(409, "Domain already monitored")
    domain = Domain(name=payload.name, label=payload.label, authorized=True)
    db.add(domain)
    db.commit()
    db.refresh(domain)
    db.add(
        Event(
            domain_id=domain.id,
            type="domain",
            severity="info",
            title=f"Monitoring enabled for {domain.name}",
            detail="Authorization was affirmed by the user.",
        )
    )
    db.commit()
    return domain


@app.delete("/api/domains/{domain_id}", status_code=204)
def delete_domain(domain_id: int, db: Session = Depends(get_db)):
    domain = db.get(Domain, domain_id)
    if not domain:
        raise HTTPException(404, "Domain not found")
    db.execute(delete(Snapshot).where(Snapshot.domain_id == domain_id))
    db.execute(delete(Event).where(Event.domain_id == domain_id))
    db.execute(delete(Candidate).where(Candidate.domain_id == domain_id))
    db.execute(delete(Asset).where(Asset.domain_id == domain_id))
    db.execute(delete(Scan).where(Scan.domain_id == domain_id))
    db.delete(domain)
    db.commit()
    shutil.rmtree(Path(settings.screenshot_dir) / str(domain_id), ignore_errors=True)


@app.get("/api/domains/{domain_id}")
def domain_detail(domain_id: int, db: Session = Depends(get_db)):
    domain = db.get(Domain, domain_id)
    if not domain:
        raise HTTPException(404, "Domain not found")
    return {
        "domain": DomainOut.model_validate(domain),
        "assets": [
            asset_dict(item)
            for item in db.scalars(
                select(Asset).where(Asset.domain_id == domain_id).order_by(desc(Asset.last_seen))
            )
        ],
        "candidates": [
            candidate_dict(item)
            for item in db.scalars(
                select(Candidate)
                .where(Candidate.domain_id == domain_id)
                .order_by(desc(Candidate.score))
            )
        ],
        "events": [
            event_dict(item)
            for item in db.scalars(
                select(Event)
                .where(Event.domain_id == domain_id)
                .order_by(desc(Event.created_at))
                .limit(100)
            )
        ],
        "scans": [
            scan_dict(item)
            for item in db.scalars(
                select(Scan).where(Scan.domain_id == domain_id).order_by(desc(Scan.id)).limit(30)
            )
        ],
    }


@app.get("/api/domains/{domain_id}/history")
def history(
    domain_id: int,
    subject: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    if not db.get(Domain, domain_id):
        raise HTTPException(404, "Domain not found")
    query = select(Snapshot).where(Snapshot.domain_id == domain_id)
    if subject:
        query = query.where(Snapshot.subject_key == subject)
    rows = db.scalars(query.order_by(desc(Snapshot.observed_at)).limit(limit)).all()
    return [
        {
            "id": row.id,
            "scan_id": row.scan_id,
            "subject_type": row.subject_type,
            "subject_key": row.subject_key,
            "state": row.state,
            "fingerprint": row.fingerprint,
            "data": row.data,
            "observed_at": row.observed_at,
        }
        for row in rows
    ]


@app.get("/api/screenshots/{screenshot_path:path}")
def screenshot(screenshot_path: str):
    root = Path(settings.screenshot_dir).resolve()
    target = (root / screenshot_path).resolve()
    if root not in target.parents or not target.is_file() or target.suffix.lower() != ".webp":
        raise HTTPException(404, "Screenshot not found")
    return FileResponse(
        target, media_type="image/webp", headers={"Cache-Control": "private, max-age=300"}
    )


@app.post("/api/domains/{domain_id}/scan", response_model=ScanOut, status_code=202)
async def start_scan(
    domain_id: int,
    background_tasks: BackgroundTasks,
    wait: bool = Query(False),
    db: Session = Depends(get_db),
):
    domain = db.get(Domain, domain_id)
    if not domain or not domain.authorized:
        raise HTTPException(404, "Authorized domain not found")
    active = db.scalar(
        select(Scan).where(
            Scan.domain_id == domain_id,
            Scan.status.in_([ScanStatus.queued, ScanStatus.running]),
        )
    )
    if active:
        raise HTTPException(409, "A scan is already active")
    scan = Scan(domain_id=domain_id)
    db.add(scan)
    db.commit()
    db.refresh(scan)
    if wait:
        await run_scan_async(scan.id)
        db.refresh(scan)
    else:
        try:
            from redis import Redis
            from rq import Queue, Retry

            connection = Redis.from_url(settings.redis_url, socket_connect_timeout=0.25)
            connection.ping()
            Queue("scans", connection=connection).enqueue(
                "spoofscope.services.run_scan",
                scan.id,
                job_timeout="20m",
                retry=Retry(max=3, interval=[60, 300, 900]),
            )
        except Exception:
            background_tasks.add_task(run_scan_async, scan.id)
    return scan


def scan_dict(item):
    return {
        "id": item.id,
        "domain_id": item.domain_id,
        "status": item.status,
        "started_at": item.started_at,
        "finished_at": item.finished_at,
        "error": item.error,
        "stats": item.stats,
    }


def event_dict(item):
    return {
        "id": item.id,
        "domain_id": item.domain_id,
        "type": item.type,
        "severity": item.severity,
        "title": item.title,
        "detail": item.detail,
        "metadata": item.metadata_,
        "created_at": item.created_at,
    }


def asset_dict(item):
    return {
        "id": item.id,
        "hostname": item.hostname,
        "kind": item.kind,
        "state": item.state,
        "data": item.data,
        "missing_scans": item.missing_scans,
        "first_seen": item.first_seen,
        "last_seen": item.last_seen,
        "disappeared_at": item.disappeared_at,
    }


def candidate_dict(item):
    return {
        "id": item.id,
        "hostname": item.hostname,
        "technique": item.technique,
        "score": item.score,
        "state": item.state,
        "signals": item.signals,
        "data": item.data,
        "missing_scans": item.missing_scans,
        "first_seen": item.first_seen,
        "last_seen": item.last_seen,
        "disappeared_at": item.disappeared_at,
    }
