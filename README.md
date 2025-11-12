# Authify-Posts

Express + MongoDB authentication with posts: registration, login, JWT cookie sessions, protected dashboard, and a Post schema for creating/viewing posts. Uses EJS + Tailwind for simple UI.

## Features
- User registration with bcrypt password hashing
- Login with bcrypt.compare and JWT issuance
- Cookie-based sessions (httpOnly)
- Protected routes (middleware verifies JWT)
- Placeholder Post schema to add posts later
- EJS views and Tailwind for UI

## Quick start

1. Clone
```bash
git clone https://github.com/<your-username>/authify-posts.git
cd authify-posts
