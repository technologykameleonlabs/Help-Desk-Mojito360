/**
 * Seed entities from Odoo CSV into Supabase
 * Run with: node scripts/seed_entities.js
 */

const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://evhwlybmnimzdepnlqrn.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("ERROR: Set SUPABASE_SERVICE_KEY environment variable");
  console.log(
    'Usage: $env:SUPABASE_SERVICE_KEY="your_service_role_key"; node scripts/seed_entities.js',
  );
  process.exit(1);
}

const CSV_PATH = path.join(
  __dirname,
  "..",
  "input",
  "odoo",
  "data",
  "Entidad (x_entidad).csv",
);

function parseCSV(content) {
  const lines = content.split("\n");
  const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing (handles quoted fields)
    const values = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }

  return rows;
}

function parseStatus(status) {
  if (status.includes("✅") || status.includes("Activa")) return "active";
  return "inactive";
}

async function insertEntities(entities) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/entities`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(entities),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Insert failed: ${response.status} - ${error}`);
  }

  return true;
}

async function main() {
  console.log("Reading CSV...");
  const content = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(content);

  console.log(`Found ${rows.length} rows in CSV`);

  const seenNames = new Set();
  const entities = [];

  for (const row of rows) {
    const name = row["Nombre de la entidad"];
    if (!name || seenNames.has(name)) continue;

    seenNames.add(name);
    entities.push({
      external_id: row["Id externa"] || null,
      name: name,
      status: parseStatus(row["Estado"] || ""),
      usage: row["Uso"] || null,
    });
  }

  console.log(`Unique entities: ${entities.length}`);

  // Insert in batches of 50
  const batchSize = 50;
  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);
    console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}...`);
    await insertEntities(batch);
  }

  console.log("Done!");
}

main().catch(console.error);
