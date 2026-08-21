import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;
const db = new Database(path.join(__dirname, "queueless.db"));
const TAMIL_NADU_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram",
  "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
  "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
  "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi",
  "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli",
  "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur",
  "Vellore", "Viluppuram", "Virudhunagar"
];

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function setupDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '📍',
      location TEXT NOT NULL,
      avg_minutes INTEGER NOT NULL DEFAULT 10,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      token_number INTEGER NOT NULL,
      service_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'WAITING'
        CHECK(status IN ('WAITING','COMPLETED','CANCELLED')),
      joined_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY(service_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS service_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(service_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS districts (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_localities (
      service_id TEXT NOT NULL,
      district_id TEXT NOT NULL,
      PRIMARY KEY(service_id, district_id),
      FOREIGN KEY(service_id) REFERENCES services(id),
      FOREIGN KEY(district_id) REFERENCES districts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_service_status
      ON tickets(service_id, status);
  `);

  const ticketColumns = db.prepare("PRAGMA table_info(tickets)").all();
  if (!ticketColumns.some(column => column.name === "details")) {
    db.exec("ALTER TABLE tickets ADD COLUMN details TEXT NOT NULL DEFAULT '{}'");
  }

  const serviceCount = db.prepare("SELECT COUNT(*) AS count FROM services").get().count;
  if (serviceCount === 0) {
    const seedServices = [
      ["ration-store","Ration Store","Essential Services","🛒","Main Market",8],
      ["hospital","Hospital OP","Healthcare","🏥","City Hospital",12],
      ["pharmacy","Pharmacy","Healthcare","💊","City Hospital",5],
      ["bank","Bank","Banking","🏦","Town Center",10],
      ["government-office","Government Office","Public Services","🏛️","Taluk Office",15],
      ["railway-counter","Railway Ticket Counter","Transport","🚆","Central Station",7],
      ["college-office","College Office","Education","🎓","College Main Block",6],
      ["salon","Salon","Personal Care","💇","Town Center",20],
      ["restaurant","Restaurant","Food","🍽️","Food Street",12],
      ["service-center","Mobile / Service Center","Repair Services","📱","Market Road",18]
    ];
    const insert = db.prepare(`
      INSERT INTO services
      (id,name,category,icon,location,avg_minutes) VALUES (?,?,?,?,?,?)
    `);
    const insertHistory = db.prepare(`
      INSERT INTO service_history (service_id,duration_minutes) VALUES (?,?)
    `);
    const transaction = db.transaction(() => {
      for (const service of seedServices) {
        insert.run(...service);
        for (const n of [service[5]-1, service[5], service[5]+1, service[5], service[5]-1]) {
          insertHistory.run(service[0], Math.max(1, n));
        }
      }
    });
    transaction();
  }

  const districtCount = db.prepare("SELECT COUNT(*) AS count FROM districts").get().count;
  if (districtCount === 0) {
    const insertDistrict = db.prepare("INSERT INTO districts (id,name) VALUES (?,?)");
    const insertDistricts = db.transaction(() => {
      for (const district of TAMIL_NADU_DISTRICTS) {
        insertDistrict.run(district.toLowerCase().replaceAll(" ", "-"), district);
      }
    });
    insertDistricts();
  }

  const insertLocality = db.prepare(`
    INSERT OR IGNORE INTO service_localities (service_id,district_id)
    VALUES (?,?)
  `);
  const mapServicesToDistricts = db.transaction(() => {
    const services = db.prepare("SELECT id FROM services").all();
    const districts = db.prepare("SELECT id FROM districts").all();
    for (const service of services) {
      for (const district of districts) {
        insertLocality.run(service.id, district.id);
      }
    }
  });
  mapServicesToDistricts();

  const adminCount = db.prepare("SELECT COUNT(*) AS count FROM admins").get().count;
  if (adminCount === 0) {
    db.prepare("INSERT INTO admins (username,password) VALUES (?,?)")
      .run("admin", "admin123");
  }
}

setupDatabase();

function getAverageMinutes(serviceId) {
  const row = db.prepare(`
    SELECT ROUND(AVG(duration_minutes)) AS average
    FROM service_history
    WHERE service_id = ?
    ORDER BY recorded_at DESC
    LIMIT 20
  `).get(serviceId);
  return Math.max(1, Number(row?.average || 10));
}

function getQueue(serviceId) {
  return db.prepare(`
    SELECT * FROM tickets
    WHERE service_id = ? AND status = 'WAITING'
    ORDER BY datetime(joined_at), rowid
  `).all(serviceId);
}

function getService(serviceId) {
  return db.prepare("SELECT * FROM services WHERE id = ?").get(serviceId);
}

function publicService(service) {
  const queueLength = db.prepare(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE service_id = ? AND status = 'WAITING'
  `).get(service.id).count;
  const average = getAverageMinutes(service.id);
  return {
    ...service,
    active: Boolean(service.active),
    avg: service.avg_minutes,
    averageServiceMinutes: average,
    queueLength,
    estimatedWaitMinutes: queueLength * average
  };
}

function enrichTicket(ticket) {
  const service = getService(ticket.service_id);
  const queue = getQueue(ticket.service_id);
  const position = queue.findIndex(item => item.id === ticket.id);
  const average = getAverageMinutes(ticket.service_id);

  return {
    id: ticket.id,
    tokenNumber: ticket.token_number,
    serviceId: ticket.service_id,
    serviceName: service?.name || "",
    customerName: ticket.customer_name,
    location: service?.location || "",
    status: ticket.status,
    details: JSON.parse(ticket.details || "{}"),
    joinedAt: ticket.joined_at,
    position: position >= 0 ? position + 1 : 0,
    averageServiceMinutes: average,
    estimatedWaitingMinutes: position >= 0 ? position * average : 0
  };
}

function adminGuard(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key !== "QUEUELESS-ADMIN-2026") {
    return res.status(401).json({ message: "Admin login required" });
  }
  next();
}

app.post("/api/admin/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const admin = db.prepare(
    "SELECT * FROM admins WHERE username = ? AND password = ?"
  ).get(username, password);

  if (!admin) {
    return res.status(401).json({ message: "Invalid admin username or password" });
  }

  res.json({
    message: "Admin login successful",
    adminKey: "QUEUELESS-ADMIN-2026",
    username: admin.username
  });
});

app.get("/api/services", (req, res) => {
  const search = String(req.query.search || "").trim().toLowerCase();
  const category = String(req.query.category || "All").trim();
  const location = String(req.query.location || "All").trim().toLowerCase();

  let services = db.prepare(
    "SELECT * FROM services WHERE active = 1 ORDER BY name"
  ).all();

  if (category.toLowerCase() !== "all") {
    services = services.filter(s => s.category.toLowerCase() === category.toLowerCase());
  }

  const district = db.prepare(
    "SELECT id FROM districts WHERE lower(name) = ?"
  ).get(location);

  if (district) {
    services = services.filter(service => db.prepare(`
      SELECT 1 FROM service_localities
      WHERE service_id = ? AND district_id = ?
    `).get(service.id, district.id));
  } else if (location !== "all") {
    services = services.filter(s => s.location.toLowerCase() === location);
  }

  if (search) {
    services = services.filter(s =>
      `${s.name} ${s.category} ${s.location}`.toLowerCase().includes(search)
    );
  }

  res.json(services.map(publicService));
});

app.get("/api/districts", (req, res) => {
  res.json(db.prepare("SELECT id,name FROM districts ORDER BY name").all());
});

app.post("/api/queues/:serviceId/join", (req, res) => {
  const service = getService(req.params.serviceId);
  const customerName = String(req.body.customerName || "").trim();
  const details = req.body.details && typeof req.body.details === "object" ? req.body.details : {};

  if (!service || !service.active) {
    return res.status(404).json({ message: "Service not found" });
  }
  if (!customerName) {
    return res.status(400).json({ message: "Customer name is required" });
  }

  const lastToken = db.prepare(`
    SELECT MAX(token_number) AS maxToken
    FROM tickets WHERE service_id = ?
  `).get(service.id).maxToken || 0;

  const ticket = {
    id: randomUUID(),
    tokenNumber: Number(lastToken) + 1,
    serviceId: service.id,
    customerName,
    joinedAt: new Date().toISOString()
  };

  db.prepare(`
    INSERT INTO tickets
    (id,token_number,service_id,customer_name,details,status,joined_at)
    VALUES (?,?,?,?,?, 'WAITING',?)
  `).run(
    ticket.id,
    ticket.tokenNumber,
    ticket.serviceId,
    ticket.customerName,
    JSON.stringify(details),
    ticket.joinedAt
  );

  res.status(201).json(enrichTicket(
    db.prepare("SELECT * FROM tickets WHERE id = ?").get(ticket.id)
  ));
});

app.get("/api/tickets/:id", (req, res) => {
  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id);
  if (!ticket) return res.status(404).json({ message: "Ticket not found" });
  res.json(enrichTicket(ticket));
});

app.delete("/api/tickets/:id", (req, res) => {
  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id);
  if (!ticket) return res.status(404).json({ message: "Ticket not found" });
  if (ticket.status !== "WAITING") {
    return res.status(400).json({ message: "This ticket is no longer waiting" });
  }

  db.prepare(`
    UPDATE tickets SET status = 'CANCELLED', completed_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), ticket.id);

  res.json({ message: "You left the queue" });
});

app.get("/api/admin/dashboard", adminGuard, (req, res) => {
  const totalWaiting = db.prepare(
    "SELECT COUNT(*) AS count FROM tickets WHERE status='WAITING'"
  ).get().count;
  const totalCompleted = db.prepare(
    "SELECT COUNT(*) AS count FROM tickets WHERE status='COMPLETED'"
  ).get().count;
  const totalCancelled = db.prepare(
    "SELECT COUNT(*) AS count FROM tickets WHERE status='CANCELLED'"
  ).get().count;

  const services = db.prepare("SELECT * FROM services ORDER BY name").all().map(service => {
    const queue = getQueue(service.id);
    return {
      ...service,
      active: Boolean(service.active),
      waitingCount: queue.length,
      completedCount: db.prepare(`
        SELECT COUNT(*) AS count FROM tickets
        WHERE service_id=? AND status='COMPLETED'
      `).get(service.id).count,
      averageServiceMinutes: getAverageMinutes(service.id),
      nextTicket: queue[0] ? enrichTicket(queue[0]) : null
    };
  });

  res.json({ totalWaiting, totalCompleted, totalCancelled, services });
});

app.post("/api/admin/services/:id/next", adminGuard, (req, res) => {
  const service = getService(req.params.id);
  if (!service) return res.status(404).json({ message: "Service not found" });

  const queue = getQueue(service.id);
  if (!queue.length) {
    return res.status(400).json({ message: "No customers are waiting" });
  }

  const ticket = queue[0];
  const completedAt = new Date();
  const joinedAt = new Date(ticket.joined_at);
  const duration = Math.max(1, Math.round((completedAt - joinedAt) / 60000));

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE tickets
      SET status='COMPLETED', completed_at=?
      WHERE id=?
    `).run(completedAt.toISOString(), ticket.id);

    db.prepare(`
      INSERT INTO service_history (service_id,duration_minutes)
      VALUES (?,?)
    `).run(service.id, duration);
  });
  transaction();

  res.json({ message: `Token #${ticket.token_number} completed successfully` });
});

app.post("/api/admin/services", adminGuard, (req, res) => {
  const name = String(req.body.name || "").trim();
  const category = String(req.body.category || "Other").trim();
  const location = String(req.body.location || "").trim();
  const icon = String(req.body.icon || "📍").trim() || "📍";
  const avg = Math.max(1, Number(req.body.avg) || 10);

  if (!name || !category || !location) {
    return res.status(400).json({ message: "Name, category and location are required" });
  }

  const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID().slice(0,8)}`;

  db.prepare(`
    INSERT INTO services
    (id,name,category,icon,location,avg_minutes)
    VALUES (?,?,?,?,?,?)
  `).run(id, name, category, icon, location, avg);

  db.prepare(`
    INSERT INTO service_history (service_id,duration_minutes)
    VALUES (?,?)
  `).run(id, avg);

  const districts = db.prepare("SELECT id FROM districts").all();
  const insertLocality = db.prepare(`
    INSERT OR IGNORE INTO service_localities (service_id,district_id)
    VALUES (?,?)
  `);
  for (const district of districts) insertLocality.run(id, district.id);

  res.status(201).json(publicService(getService(id)));
});

app.delete("/api/admin/services/:id", adminGuard, (req, res) => {
  const service = getService(req.params.id);
  if (!service) return res.status(404).json({ message: "Service not found" });

  const waiting = getQueue(service.id);
  if (waiting.length) {
    return res.status(400).json({ message: "Cannot deactivate a service with waiting customers" });
  }

  db.prepare("UPDATE services SET active=0 WHERE id=?").run(service.id);
  res.json({ message: "Service deactivated" });
});

app.get("/api/admin/recent", adminGuard, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM tickets
    ORDER BY datetime(joined_at) DESC
    LIMIT 20
  `).all();

  res.json(rows.map(enrichTicket));
});

app.get("/api/admin/tamil-nadu-directory", adminGuard, (req, res) => {
  res.json({
    districts: db.prepare("SELECT id,name FROM districts ORDER BY name").all(),
    services: db.prepare(`
      SELECT id,name,category,location,avg_minutes AS averageMinutes
      FROM services WHERE active = 1 ORDER BY name
    `).all()
  });
});

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`QueueLess running at http://localhost:${PORT}`);
  console.log("Default admin login: admin / admin123");
});
