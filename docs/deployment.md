# Deployment

This guide covers production deployment of ClipChat Engine using Docker Compose, with options for S3 storage and horizontal scaling.

---

## Docker Compose (recommended)

The included `docker-compose.yml` starts Postgres, Redis, and the ClipChat engine:

```bash
# Clone and configure
git clone https://github.com/your-org/clipchat.git
cd clipchat
cp .env.example .env
# Edit .env with your production values

# Build and start
docker compose build
docker compose up -d

# Generate your first API key
docker compose exec engine npm run create-api-key -w packages/engine -- "production"
```

The API will be available at `http://localhost:3000` (or whatever `PORT` you set).

### Verify

```bash
curl http://localhost:3000/health
# {"status":"ok","version":"0.1.0"}
```

---

## Environment Variables

Copy `.env.example` to `.env` and set all required values:

```env
# Required
DATABASE_URL=postgres://postgres:CHANGE_ME@localhost:5432/clipchat
REDIS_URL=redis://localhost:6379

# Storage (local or s3)
STORAGE_DRIVER=local
UPLOAD_DIR=./uploads

# Server
PORT=3000

# Worker
WORKER_CONCURRENCY=2
```

**Never commit `.env` to version control.** Use your platform's secret management (Docker secrets, AWS Secrets Manager, environment injection in CI/CD).

---

## Database Migrations

Migrations run automatically on container start (via `db:migrate` in the Dockerfile entrypoint). To run them manually:

```bash
docker compose exec engine npm run db:migrate -w packages/engine
```

To reset the database (deletes all data):

```bash
docker compose down -v          # removes volumes including pgdata
docker compose up -d postgres
docker compose exec engine npm run db:migrate -w packages/engine
```

---

## API Key Management

Generate keys using the script — keys are hashed (SHA-256) before storage:

```bash
# Inside container
docker compose exec engine npm run create-api-key -w packages/engine -- "label"

# Outside container (requires DATABASE_URL in env)
DATABASE_URL=postgres://... npm run create-api-key -w packages/engine -- "label"
```

Output:
```
API key created for "label":
clp_a1b2c3d4e5f6...

Store this safely — it will not be shown again.
```

There is no built-in key revocation UI. To revoke a key, delete the row from the `api_keys` table:
```sql
DELETE FROM api_keys WHERE label = 'old-key';
```

---

## S3 Storage

For production, use S3 (or any S3-compatible service) instead of local disk:

```env
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=my-clipchat-bucket
```

**IAM policy** — grant the engine's IAM role these permissions on the bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::my-clipchat-bucket/*"
    }
  ]
}
```

With S3 storage:
- `path` in file records will be an `s3://bucket/key` URI
- `url` will be a presigned download URL (valid for 1 hour)
- Uploaded files are **not** automatically deleted — set up an S3 lifecycle policy if needed

---

## MinIO (S3-compatible, self-hosted)

MinIO is a drop-in S3-compatible replacement for local S3 development or air-gapped deployments:

```yaml
# Add to docker-compose.yml
minio:
  image: minio/minio
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  ports:
    - "9000:9000"
    - "9001:9001"
  volumes:
    - minio_data:/data

volumes:
  minio_data:
```

Then configure the engine:

```env
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=clipchat
S3_ENDPOINT=http://minio:9000
```

Create the bucket via MinIO console at `http://localhost:9001` or with the mc CLI:
```bash
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/clipchat
```

---

## Worker Concurrency

The BullMQ worker processes FFmpeg jobs. Control how many run in parallel:

```env
WORKER_CONCURRENCY=2
```

Guidelines:
- Default: `2` (safe for most VMs)
- Set to number of CPU cores for CPU-bound workloads
- Keep at `1–2` if memory is constrained (FFmpeg can use 500MB+ per job)
- For high throughput, run multiple engine containers (each has its own worker)

---

## Scaling

To run multiple engine instances sharing the same queue:

```yaml
# docker-compose.yml
engine:
  build: .
  deploy:
    replicas: 3
  environment:
    - DATABASE_URL=${DATABASE_URL}
    - REDIS_URL=${REDIS_URL}
    - STORAGE_DRIVER=s3     # required for multi-instance (shared storage)
```

All instances connect to the same Redis queue. BullMQ distributes jobs across workers automatically. **Local storage does not work with multiple instances** — use S3.

---

## Reverse Proxy (nginx)

Run nginx in front of the engine for TLS termination and request buffering:

```nginx
upstream clipchat {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    client_max_body_size 5g;    # match max upload size

    location / {
        proxy_pass http://clipchat;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 600s;    # long-running FFmpeg jobs
    }

    # SSE requires buffering disabled
    location ~ ^/api/v1/jobs/.+/stream$ {
        proxy_pass http://clipchat;
        proxy_http_version 1.1;
        proxy_set_header Cache-Control 'no-cache';
        proxy_buffering off;
        proxy_read_timeout 600s;
    }
}
```

---

## Health Checks

The `/health` endpoint is public and returns `{"status":"ok","version":"0.1.0"}`. Use it for load balancer health checks and uptime monitoring.

Docker Compose health check (already in `docker-compose.yml`):
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 5s
  retries: 3
```

---

## Production Hardening

- **Change default Postgres password** — update `POSTGRES_PASSWORD` and `DATABASE_URL`
- **Bind Redis to localhost** — don't expose Redis publicly; keep it internal to Docker network
- **Use TLS** — terminate SSL at nginx or a load balancer, never in the engine process
- **Set `NODE_ENV=production`** — enables Express production optimizations
- **Limit upload directory permissions** — `chmod 750 ./uploads && chown node:node ./uploads`
- **Monitor disk space** — FFmpeg output files accumulate; clean up with the `DELETE /api/v1/files/:id` endpoint or an S3 lifecycle policy
- **Set up log rotation** — Docker logs can grow unbounded; configure `max-size` and `max-file` in daemon.json
