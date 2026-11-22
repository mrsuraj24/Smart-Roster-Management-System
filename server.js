const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, "roster.db"));
db.pragma("foreign_keys = ON");
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      pod_id INTEGER,
      weekly_off TEXT NOT NULL,
      skills TEXT DEFAULT '',
      active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS pods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      lead TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pod_id INTEGER,
      calendar TEXT NOT NULL DEFAULT 'DAILY',
      active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS processes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      min_staff INTEGER NOT NULL DEFAULT 1,
      calendar TEXT NOT NULL DEFAULT 'DAILY'
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      brand_id INTEGER NOT NULL,
      process_id INTEGER NOT NULL,
      UNIQUE(employee_id, brand_id, process_id)
    );
    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'LEAVE'
    );
    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );
  `);

  const count = db.prepare("SELECT COUNT(*) c FROM employees").get().c;
  if (!count) seed();
}

function seed() {
  const pods = [
    ["Alpha Pod", "Neha Sharma"], ["Bravo Pod", "Rahul Mehta"], ["Charlie Pod", "Priya Singh"],
    ["Delta Pod", "Amit Patil"], ["Echo Pod", "Sneha Joshi"], ["Foxtrot Pod", "Vikram Rao"]
  ];
  const addPod = db.prepare("INSERT INTO pods(name,lead) VALUES(?,?)");
  pods.forEach(p => addPod.run(...p));

  const brands = [
    ["UrbanCart", 1, "DAILY"], ["GlowBasket", 1, "365"], ["HomeNest", 2, "DAILY"],
    ["FitFuel", 2, "SUN_OFF"], ["StyleHub", 3, "DAILY"], ["PetPanda", 3, "365"],
    ["FreshDrop", 4, "SUN_OFF"], ["GadgetLane", 4, "DAILY"], ["CarePlus", 5, "365"],
    ["BabyBloom", 5, "DAILY"], ["KitchenKart", 6, "SUN_OFF"], ["TravelMint", 6, "DAILY"]
  ];
  const addBrand = db.prepare("INSERT INTO brands(name,pod_id,calendar) VALUES(?,?,?)");
  brands.forEach(b => addBrand.run(...b));

  const brandRows = db.prepare("SELECT * FROM brands").all();
  const processByBrand = {
    UrbanCart: ["Customer Support", "NDR"],
    GlowBasket: ["Customer Support", "ACC", "NDR"],
    HomeNest: ["Customer Support", "Retention"],
    FitFuel: ["Customer Support", "ACC"],
    StyleHub: ["Customer Support", "ACC", "NDR"],
    PetPanda: ["Customer Support", "Retention"],
    FreshDrop: ["Customer Support", "NDR"],
    GadgetLane: ["Customer Support", "ACC", "NDR"],
    CarePlus: ["Customer Support", "Retention", "NDR"],
    BabyBloom: ["Customer Support", "ACC"],
    KitchenKart: ["Customer Support", "NDR"],
    TravelMint: ["Customer Support", "Retention"]
  };
  const addProcess = db.prepare("INSERT INTO processes(brand_id,name,min_staff,calendar) VALUES(?,?,?,?)");
  for (const b of brandRows) {
    for (const p of processByBrand[b.name]) {
      const min = p === "Customer Support" ? 1 : (p === "NDR" ? 1 : 1);
      addProcess.run(b.id, p, min, b.calendar);
    }
  }

  const first = ["Aarav", "Vivaan", "Aditya", "Arjun", "Rohan", "Vivek", "Kunal", "Nikhil", "Yash", "Rahul",
    "Sahil", "Ankit", "Mohit", "Varun", "Rajat", "Neeraj", "Pooja", "Priya", "Sneha", "Neha",
    "Kavya", "Anjali", "Riya", "Isha", "Simran", "Meera", "Nandini", "Aditi", "Shreya", "Tanvi"];
  const last = ["Sharma", "Yadav", "Singh", "Patil", "Verma", "Gupta", "Kumar", "Joshi", "Rao", "Mishra"];
  const offs = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const addEmp = db.prepare("INSERT INTO employees(name,email,pod_id,weekly_off,skills) VALUES(?,?,?,?,?)");
  for (let i = 0; i < 30; i++) {
    const pod = (i % 6) + 1;
    addEmp.run(`${first[i]} ${last[i % last.length]}`, `${first[i].toLowerCase()}.${last[i % last.length].toLowerCase()}${i + 1}@example.com`,
      pod, offs[i % offs.length], i % 3 === 0 ? "CS, NDR" : (i % 3 === 1 ? "CS, ACC" : "CS, Retention"));
  }

  const employees = db.prepare("SELECT * FROM employees").all();
  const processes = db.prepare("SELECT p.*, b.name brand_name FROM processes p JOIN brands b ON b.id=p.brand_id ORDER BY p.id").all();

  // ~80% single-resource brands; selected brands have 2-3 people.
  const assignments = [];
  for (const b of brandRows) {
    const brandEmployees = employees.filter(e => e.pod_id === b.pod_id);
    const target = ["GlowBasket", "StyleHub", "GadgetLane", "CarePlus"].includes(b.name) ? 3 : 1;
    const selected = brandEmployees.slice(0, target);
    for (const e of selected) {
      const ps = processes.filter(p => p.brand_id === b.id);
      ps.forEach((p, idx) => {
        if (target === 1 || idx % target === (e.id % target)) {
          assignments.push([e.id, b.id, p.id]);
        }
      });
    }
  }
  const addAssign = db.prepare("INSERT OR IGNORE INTO assignments(employee_id,brand_id,process_id) VALUES(?,?,?)");
  assignments.forEach(a => addAssign.run(...a));

  const addHoliday = db.prepare("INSERT OR IGNORE INTO holidays(date,name) VALUES(?,?)");
  const year = new Date().getFullYear();
  [
    [`${year}-01-26`, "Republic Day"], [`${year}-08-15`, "Independence Day"],
    [`${year}-10-02`, "Gandhi Jayanti"], [`${year}-12-25`, "Christmas"]
  ].forEach(h => addHoliday.run(...h));

  // A couple of planned leaves for the demo.
  const addLeave = db.prepare("INSERT INTO leaves(employee_id,date,type) VALUES(?,?,?)");
  addLeave.run(2, `${year}-11-24`, "LEAVE");
  addLeave.run(5, `${year}-11-27`, "LEAVE");
}

function rows(sql, params = []) { return db.prepare(sql).all(...params); }
function one(sql, params = []) { return db.prepare(sql).get(...params); }

app.get("/api/summary", (req, res) => {
  res.json({
    employees: one("SELECT COUNT(*) c FROM employees WHERE active=1").c,
    brands: one("SELECT COUNT(*) c FROM brands WHERE active=1").c,
    processes: one("SELECT COUNT(*) c FROM processes").c,
    pods: one("SELECT COUNT(*) c FROM pods").c,
    assignments: one("SELECT COUNT(*) c FROM assignments").c
  });
});

app.get("/api/employees", (req, res) => res.json(rows(`
  SELECT e.*, p.name pod_name FROM employees e LEFT JOIN pods p ON p.id=e.pod_id
  WHERE e.active=1 ORDER BY e.id
`)));
app.get("/api/pods", (req, res) => res.json(rows("SELECT * FROM pods ORDER BY id")));
app.get("/api/brands", (req, res) => res.json(rows(`
  SELECT b.*, p.name pod_name FROM brands b LEFT JOIN pods p ON p.id=b.pod_id
  WHERE b.active=1 ORDER BY b.id
`)));
app.get("/api/processes", (req, res) => res.json(rows(`
  SELECT p.*, b.name brand_name FROM processes p JOIN brands b ON b.id=p.brand_id ORDER BY p.id
`)));
app.get("/api/assignments", (req, res) => res.json(rows(`
  SELECT a.*, e.name employee_name, b.name brand_name, p.name process_name
  FROM assignments a
  JOIN employees e ON e.id=a.employee_id
  JOIN brands b ON b.id=a.brand_id
  JOIN processes p ON p.id=a.process_id
  ORDER BY b.id, e.id
`)));
app.get("/api/leaves", (req, res) => res.json(rows("SELECT * FROM leaves ORDER BY date")));
app.get("/api/holidays", (req, res) => res.json(rows("SELECT * FROM holidays ORDER BY date")));

app.post("/api/leaves", (req, res) => {
  const { employee_id, date, type = "LEAVE" } = req.body;
  if (!employee_id || !date) return res.status(400).json({ error: "Employee and date are required" });
  const info = db.prepare("INSERT INTO leaves(employee_id,date,type) VALUES(?,?,?)").run(employee_id, date, type);
  res.json({ id: info.lastInsertRowid });
});

app.post("/api/assignments", (req, res) => {
  const { employee_id, brand_id, process_id } = req.body;
  if (!employee_id || !brand_id || !process_id) return res.status(400).json({ error: "All assignment fields are required" });
  try {
    const info = db.prepare("INSERT INTO assignments(employee_id,brand_id,process_id) VALUES(?,?,?)").run(employee_id, brand_id, process_id);
    res.json({ id: info.lastInsertRowid });
  } catch {
    res.status(409).json({ error: "This assignment already exists." });
  }
});

app.delete("/api/assignments/:id", (req, res) => {
  db.prepare("DELETE FROM assignments WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

function dateList(year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return { date: `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`, dow: d.getDay() };
  });
}
function employeeUnavailable(emp, date, holidays, leaves) {
  const holiday = holidays.some(h => h.date === date);
  const leave = leaves.some(l => l.employee_id === emp.id && l.date === date);
  const dow = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(date + "T00:00:00").getDay()];
  return leave || dow === emp.weekly_off || (holiday && emp.weekly_off === "HOLIDAY_ONLY");
}
function brandNeedsWork(brand, date, holidays) {
  const holiday = holidays.some(h => h.date === date);
  const dow = new Date(date + "T00:00:00").getDay();
  if (brand.calendar === "365") return true;
  if (brand.calendar === "SUN_OFF") return dow !== 0 && !holiday;
  return !holiday;
}

app.post("/api/generate", (req, res) => {
  const year = Number(req.body.year || new Date().getFullYear());
  const month = Number(req.body.month ?? new Date().getMonth());
  const dates = dateList(year, month);
  const employees = rows("SELECT * FROM employees WHERE active=1");
  const brands = rows("SELECT * FROM brands WHERE active=1");
  const processes = rows("SELECT * FROM processes");
  const assignments = rows("SELECT * FROM assignments");
  const leaves = rows("SELECT * FROM leaves");
  const holidays = rows("SELECT * FROM holidays");
  const roster = [];
  const conflicts = [];

  const empMap = new Map(employees.map(e => [e.id, e]));
  const brandMap = new Map(brands.map(b => [b.id, b]));
  const processMap = new Map(processes.map(p => [p.id, p]));

  for (const d of dates) {
    for (const e of employees) {
      const unavailable = employeeUnavailable(e, d.date, holidays, leaves);
      roster.push({ date: d.date, employee_id: e.id, employee_name: e.name, status: unavailable ? "OFF" : "WORK" });
    }

    for (const p of processes) {
      const b = brandMap.get(p.brand_id);
      if (!brandNeedsWork(b, d.date, holidays)) continue;
      const assigned = assignments.filter(a => a.process_id === p.id);
      const available = assigned.filter(a => {
        const e = empMap.get(a.employee_id);
        return e && !employeeUnavailable(e, d.date, holidays, leaves);
      });
      if (available.length < p.min_staff) {
        conflicts.push({
          date: d.date, severity: "CRITICAL", type: "Coverage Gap",
          brand: b.name, process: p.name,
          message: `${p.min_staff} required, only ${available.length} available`
        });
      }
    }
  }

  // Detect employees assigned to multiple brands/processes. This app treats same-day work as
  // acceptable when the employee is a shared resource, but flags it for manager review.
  const byEmp = {};
  for (const a of assignments) (byEmp[a.employee_id] ||= []).push(a);
  for (const [id, arr] of Object.entries(byEmp)) {
    const brandsForEmp = [...new Set(arr.map(a => a.brand_id))];
    if (brandsForEmp.length > 1) {
      conflicts.push({
        date: null, severity: "WARNING", type: "Shared Resource",
        brand: "Multiple", process: "Multiple",
        message: `${empMap.get(Number(id)).name} is assigned across ${brandsForEmp.length} brands. Confirm daily capacity.`
      });
    }
  }

  res.json({ year, month, roster, conflicts, holidays });
});

app.get("/api/brand-coverage", (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  const month = Number(req.query.month ?? new Date().getMonth());
  const dates = dateList(year, month);
  const holidays = rows("SELECT * FROM holidays");
  const brands = rows("SELECT * FROM brands WHERE active=1");
  const processes = rows("SELECT * FROM processes");
  const assignments = rows("SELECT * FROM assignments");
  const employees = rows("SELECT * FROM employees WHERE active=1");
  const leaves = rows("SELECT * FROM leaves");
  const out = [];
  for (const b of brands) {
    for (const p of processes.filter(x => x.brand_id === b.id)) {
      for (const d of dates) {
        if (!brandNeedsWork(b, d.date, holidays)) continue;
        const assigned = assignments.filter(a => a.process_id === p.id);
        const available = assigned.filter(a => {
          const e = employees.find(x => x.id === a.employee_id);
          return e && !employeeUnavailable(e, d.date, holidays, leaves);
        }).length;
        out.push({ date: d.date, brand: b.name, process: p.name, required: p.min_staff, available, ok: available >= p.min_staff });
      }
    }
  }
  res.json(out);
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
initDb();
app.listen(PORT, () => console.log(`Smart Roster running at http://localhost:${PORT}`));
