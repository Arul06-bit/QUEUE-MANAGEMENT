# QueueLess – Full Stack Queue Management System

To avoid standing in queues and wasting time.

QueueLess is a simple college-project-ready digital queue management application.

## Live Application

Open QueueLess: https://queueless-tn2a.onrender.com

## What was improved

- Properly organized frontend and backend code.
- Replaced the JSON data store with a real **SQLite database**.
- Database is created automatically as `queueless.db` on first run.
- Added tables for:
  - Services
  - Tickets
  - Service history
  - Admin users
- Added working **Admin Login**.
- Admin can:
  - View total waiting, completed and cancelled customers.
  - See every queue place.
  - Call the next customer.
  - Add a new queue place.
  - Deactivate a queue place.
  - View recent activity.
- Customer can:
  - Search services.
  - Filter by category.
  - Join a queue.
  - Get a virtual token.
  - Track position and estimated waiting time.
  - Leave the queue.
- Waiting-time prediction uses recent completed service durations stored in SQLite.

## Folder structure

```text
QueueLess-Updated/
├── package.json
├── server.js
├── queueless.db          # created automatically after first run
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
└── README.md
```

## How to run in VS Code

1. Extract the ZIP file.
2. Open the `QueueLess-Updated` folder in VS Code.
3. Open Terminal / Git Bash.
4. Run:

```bash
npm install
npm start
```

5. Open:

```text
http://localhost:5000
```

## Admin login

Click **Admin** in the top navigation.

```text
Username: admin
Password: admin123
```

## Important

The default admin password is intended for a college/demo project. For a real production application, use hashed passwords, proper sessions/JWT, HTTPS and environment variables for secrets.
