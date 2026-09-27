# Deployment guide

## Recommended topology

Run the supplied Compose stack on a dedicated host. The default configuration publishes the `web` service only on `127.0.0.1:8080`; PostgreSQL and Redis remain on the private Compose network. Use an SSH local port forward for private administration. For Internet-facing access, place a TLS reverse proxy or VPN on the same host in front of the loopback listener.

## Initial deployment

```bash
cp .env.example .env
```

Generate URL-safe secrets, for example:

```bash
python -c "import secrets; print(secrets.token_urlsafe(36))"
```

Use separate values for `POSTGRES_PASSWORD` and `SPOOFSCOPE_API_KEY`, then run:

```bash
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:8080/api/health
```

For access from a remote workstation without opening another host port:

```bash
ssh -N -L 127.0.0.1:8080:127.0.0.1:8080 user@docker-host
```

## Reverse proxy

Forward HTTPS traffic to `http://127.0.0.1:8080`, preserve the original host and scheme, and apply an upload/body-size limit. SpoofScope does not require WebSockets. Keep the built-in API key enabled even when the proxy also authenticates users.

## Backups

Back up PostgreSQL with `pg_dump` and preserve the `screenshot_data` volume from approximately the same point in time. Redis contains transient job state and does not need to be part of a durable backup.

```bash
docker compose exec -T db pg_dump -U spoofscope -Fc spoofscope > spoofscope.dump
docker run --rm -v spoofscope_screenshot_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/spoofscope-screenshots.tgz -C /data .
```

Test restores periodically. Protect backups because public screenshots may contain sensitive information.

## Updating

```bash
git pull --ff-only
docker compose build --pull
docker compose up -d
docker compose ps
```

The API container runs Alembic migrations before accepting traffic. Take a database backup before upgrading across releases.

## Monitoring

- Poll `/api/health` without authentication.
- Scrape `/api/metrics` with `X-SpoofScope-Key`.
- Collect JSON logs from API and worker containers.
- Alert on repeated `failed` scans, an unhealthy worker, database storage growth, and screenshot-volume capacity.

## Hardening checklist

- Keep the default loopback-only port binding unless a firewall, VPN, or authenticated reverse proxy explicitly protects access.
- Use HTTPS for every non-local deployment.
- Apply outbound network controls that allow DNS and public HTTP/S while denying private ranges.
- Rotate the API key and database password periodically.
- Reduce retention or disable screenshots when they are unnecessary.
- Keep Docker, base images, and dependencies patched.
- Review the authorization and legal basis for every monitored domain.
