# SnapShare Scaling Plan

## 1. Assumptions

- 10,000,000 registered users, 10% active daily: **1,000,000 DAU**
- Each active user uploads 1 photo and views 50 feed pages per day
- Photo 2 MB, thumbnail 50 KB, 1 day ≈ 100,000 seconds, peak = 5× average

## 2. Estimates

- Uploads: 1,000,000/day ÷ 100,000 ≈ **10/s** (peak **50/s**)
- Feed views: 50,000,000/day ÷ 100,000 ≈ **500/s** (peak **2,500/s**)
- Storage: 1,000,000 × 2.05 MB ≈ 2 TB/day ≈ **750 TB/year**

## 3. Read-heavy or write-heavy?

**Read-heavy**: about 50 feed views for every upload. Reads must be cheap (CDN, cache, read replica), and uploads should be reliable rather than instant. Storage is also huge, so files need their own system.

## 4. Where do the photos go?

Not in the database. 750 TB a year of large files would make it huge, slow and expensive to back up, and it cannot serve files from servers near the user. Photos go in **object storage** (e.g. Amazon S3), which is cheap and durable. The database keeps only metadata: id, owner, caption, time and the file URL.

## 5. Architecture diagram

```
Client (browser/mobile) ──> DNS
   │ photos, thumbnails
   ├──────────> CDN ──(miss)──> Object storage <────────┐
   │ API (HTTPS)                                        │ saves files
   v                                                    │
Load balancer                                           │
   ├──> App server 1 ─┐                                 │
   ├──> App server 2 ─┼──> Cache (Redis)                │
   └──> App server 3 ─┘                                 │
        │ writes/reads          │ jobs                  │
        v                       v                       │
Primary DB ──copies──> Read replica  Queue ──> Worker ──┘
```

## 6. Components

- **DNS:** turns snapshare.com into server addresses.
- **CDN:** serves photos from servers near users, so images load fast and our servers are not overloaded.
- **Load balancer:** spreads requests and skips failed servers, so no single server is a bottleneck.
- **App servers (stateless):** run the API, and we add more as traffic grows.
- **Cache (Redis):** keeps prepared feeds in memory so most feed views skip the database.
- **Primary database:** the source of truth for users, follows and photo metadata, and takes all writes.
- **Read replica:** serves the heavy feed queries and protects the primary.
- **Object storage:** cheap, durable home for hundreds of terabytes of files.
- **Queue:** holds thumbnail jobs so uploads reply quickly and bursts wait in line.
- **Worker:** creates thumbnails in the background, away from the upload request.

## 7. Upload flow

1. The client sends `POST /photos` through the load balancer to an app server.
2. The app server checks the token, file type and size.
3. It saves the original to object storage.
4. It inserts a metadata row in the primary database (status "processing").
5. It adds the job "make thumbnail for photo 123" to the queue.
6. It replies **201 Created** straight away.
7. A worker takes the job, creates the 50 KB thumbnail and saves it to object storage.
8. The worker updates the photo's row with the thumbnail URL and status "ready", and the primary copies this to the read replica.
9. Followers' cached feeds are invalidated, so the next feed load shows the photo and its thumbnail from the CDN. If the worker fails, the job stays in the queue and is retried.

## 8. Trade-offs

1. **Eventual consistency vs read-after-write consistency:** feeds come from the cache and replicas, so a new photo may take a few seconds to appear for followers (replication lag, cache expiry). This is fine for a social app and greatly cuts database load. The uploader can see their own photo at once because the app shows it directly.
2. **Complexity vs latency:** background thumbnails keep uploads fast, but add a queue and worker to run, and for a moment the photo shows a placeholder instead of a thumbnail.
3. **Cost vs reliability:** CDN and object storage cost money per gigabyte, but they are cheaper and more reliable than serving hundreds of terabytes from our own servers.
