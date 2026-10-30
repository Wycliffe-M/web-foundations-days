# SnapShare Scaling Plan

SnapShare is a photo-sharing app where users upload photos and scroll a feed of photos from people they follow.

## 1. Assumptions

- 10,000,000 registered users
- 10% of them are active on a given day
- Each active user uploads 1 photo per day
- Each active user views 50 feed pages per day
- An average photo is 2 MB, and each photo also gets a 50 KB thumbnail
- One day is about 100,000 seconds (rounded from 86,400 to keep the maths easy)
- Peak traffic is 5 times the average

**Daily active users (DAU):** 10,000,000 × 10% = **1,000,000**

## 2. Estimates

**Uploads (writes)**

- 1,000,000 users × 1 photo = 1,000,000 uploads per day
- 1,000,000 ÷ 100,000 ≈ **10 uploads per second** (average)
- Peak: 10 × 5 = **50 uploads per second**

**Feed views (reads)**

- 1,000,000 users × 50 feed pages = 50,000,000 feed views per day
- 50,000,000 ÷ 100,000 ≈ **500 feed views per second** (average)
- Peak: 500 × 5 = **2,500 feed views per second**

**Photo storage per year**

- Originals: 1,000,000 × 2 MB = 2,000,000 MB = 2 TB per day
- Thumbnails: 1,000,000 × 50 KB = 50 GB per day
- Total: about 2.05 TB per day
- Per year: 2.05 TB × 365 ≈ **750 TB per year** (about 730 TB of originals plus 18 TB of thumbnails)

## 3. Read-heavy or write-heavy?

SnapShare is **read-heavy**. Feed views (500 per second) happen about 50 times more often than uploads (10 per second).

What this means for the design:

- Reads need to be cheap, so we use a **cache** for feed data and a **CDN** for photos and thumbnails.
- A **read replica** takes feed queries off the primary database, which only handles writes.
- Writes are rare enough that one primary database can handle them.
- Storage is the exception. Although uploads are few, each one is large, so the **bytes** we store (750 TB per year) are the real scaling problem. That is why photo files need their own storage system.

## 4. Why photos do not belong in the database

- Photos are large files (2 MB each). At 750 TB per year, the database would become huge, slow to back up and very expensive to scale.
- Databases are built for small structured rows that we search and join, not for big binary files that we only store and fetch.
- Every photo download would use database connections and memory that queries need.
- A database cannot serve files from servers close to the user, while a CDN can.

Instead, the photo files go in **object storage** (for example Amazon S3), which is cheap, scales almost without limit and keeps copies of the data safely. The database stores only a small row for each photo: its id, owner, caption, upload time and the **storage key** (a link to the file). The CDN then serves the files from object storage.

## 5. Architecture diagram

```
 ┌─────────┐   ┌─────────┐
 │ Client  │──>│   DNS   │  (snapshare.com -> IP addresses)
 │(browser/│   └─────────┘
 │ mobile) │
 └──┬───┬──┘
    │   │ photos and static files
    │   └──────────────> ┌─────────┐  miss  ┌────────────────┐
    │                    │   CDN   │ -----> │ Object storage │
    │                    └─────────┘        │ originals +    │
    │ API calls (HTTPS)                     │ thumbnails     │
    v                                       └───────▲────────┘
 ┌───────────────┐                                  │
 │ Load balancer │                                  │ saves files
 └───────┬───────┘                                  │
    ┌────┴──────┬──────────┐                        │
    v           v          v                        │
 ┌───────┐  ┌───────┐  ┌───────┐   ┌──────────────┐ │
 │ App 1 │  │ App 2 │  │ App 3 │──>│ Cache(Redis) │ │
 └──┬────┘  └──┬────┘  └──┬────┘   └──────────────┘ │
    │ writes   │ reads    │ thumbnail jobs          │
    v          v          v                         │
 ┌─────────┐ ┌─────────┐ ┌───────┐   ┌────────┐     │
 │ Primary │>│  Read   │ │ Queue │──>│ Worker │─────┘
 │   DB    │ │ replica │ └───────┘   └────────┘
 └─────────┘ └─────────┘             (creates thumbnails)
```

## 6. What each component does

- **Client:** shows the feed and sends uploads and API requests to the servers.
- **DNS:** turns the name snapshare.com into the address of our servers, so users do not need to know any IP addresses.
- **CDN:** keeps copies of photos, thumbnails and static files on servers near the user, which solves slow downloads from a faraway origin.
- **Load balancer:** spreads requests across the app servers and skips unhealthy ones, which removes the single server as a bottleneck and a single point of failure.
- **App servers (2 or more, stateless):** run the API code, and because they hold no user data, we can add or replace servers whenever load changes.
- **Cache (Redis):** keeps recent feeds in memory so most feed views never touch the database, which solves the heavy read load.
- **Primary database:** holds the one true copy of users, follows and photo records, and handles all writes.
- **Read replica:** a copy of the primary that serves read queries, which stops feed reads from slowing down uploads.
- **Object storage:** stores the large photo files cheaply and reliably, which solves the problem of 750 TB per year not fitting in a database.
- **Queue:** holds thumbnail jobs so the app server can reply to the user straight away, and a sudden burst of uploads waits in line instead of overloading the system.
- **Worker:** takes jobs from the queue and creates the 50 KB thumbnails in the background, which keeps slow image processing out of the upload request.

## 7. Upload flow, step by step

1. The user picks a photo and the client sends `POST /photos` over HTTPS.
2. DNS has already told the client where to go, and the request reaches the **load balancer**, which forwards it to a healthy **app server**.
3. The app server checks the token, then validates the file (type and size).
4. The app server saves the original photo (2 MB) in **object storage** and receives a storage key.
5. The app server writes a row to the **primary database** (photo id, user id, storage key, status "processing").
6. The app server adds a job to the **queue**: "create a thumbnail for photo 123".
7. The app server deletes the user's cached feed entry in Redis, so stale data is not served, and replies **201 Created** immediately. The user does not wait for the thumbnail.
8. A **worker** takes the job from the queue, downloads the original, creates a 50 KB thumbnail and saves it in object storage.
9. The worker updates the database row to status "ready". The primary then copies the change to the **read replica** within milliseconds.
10. When followers load their feeds, the thumbnails and photos come through the **CDN**. If the worker fails, the job stays in the queue and is retried.

## 8. Trade-offs

- **Speed versus freshness:** caching feeds and reading from a replica make the feed very fast, but a follower may see a new photo a few seconds late because of cache expiry (TTL) and replication lag. For a photo feed this is acceptable. For something like a bank balance it would not be.
- **Simplicity versus scalability:** a single server would be easy to build and run, but it would be a single point of failure and could not handle 2,500 feed views per second at peak. Many servers, a cache, a replica and a queue scale much further, but are harder to build, debug and run.
- **Cost versus reliability:** extra app servers, replicas and copies of the photos in object storage and CDN increase uptime and safety, but cost more money. At 750 TB per year, storage cost is a real decision.
- **Doing work now versus later:** creating thumbnails in the background keeps uploads fast, but for a few seconds the photo may appear without its thumbnail.
