# Reflection

## Most difficult concept

The hardest concept for me was caching and cache invalidation. I understood that a cache like Redis makes reads faster, but I struggled to see what goes wrong when the data changes. What helped was working through the cache-aside flow step by step for QuickNotes: check the cache, on a miss read the database and store the result with a TTL, and on a write update the database and delete the cached key. Writing that flow out in my Project 2 architecture document, and then seeing it again in the Day 7 quiz, made it click. Stale data is the price of speed, and the right choice depends on the product.

## What I would improve

My Project 2 feedback suggested expanding the failover section of my architecture document. At the moment I only say that a read replica can take over if the primary database fails. I would add a health monitor that detects the failure and promotes the replica automatically, and explain what happens to writes during the switch. That would make my single points of failure section much more complete.

## What I will learn next

Next I want to build a real backend with Node.js and Express, so I can turn the API I designed for QuickNotes into working code. After that I will connect it to a PostgreSQL database, because I have designed tables and written SQL but have not yet used a real database from an application. I also want to keep practising the basics, because fluency comes from repetition.
