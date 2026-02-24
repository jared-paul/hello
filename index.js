const http = require('http');
const { Client } = require('pg');

const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;

let pgClient = null;
let dbConnected = false;

// Initialize PostgreSQL connection
async function initDatabase() {
  if (!databaseUrl) {
    console.log('DATABASE_URL not set, running without database');
    return false;
  }

  try {
    pgClient = new Client({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5000,
    });

    await pgClient.connect();
    console.log('Connected to PostgreSQL database');

    // Create visitors table if not exists
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS visitors (
        id SERIAL PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        last_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Visitors table ready');

    // Initialize counter row if it doesn't exist
    const result = await pgClient.query('SELECT COUNT(*) as count FROM visitors');
    if (result.rows[0].count === '0') {
      await pgClient.query('INSERT INTO visitors (count) VALUES (0)');
      console.log('Initialized visitor counter');
    }

    dbConnected = true;
    return true;
  } catch (error) {
    console.error('Failed to connect to database:', error.message);
    dbConnected = false;
    return false;
  }
}

// Increment and return visitor count
async function incrementVisitorCount() {
  if (!dbConnected || !pgClient) {
    return null;
  }

  try {
    const result = await pgClient.query(
      'UPDATE visitors SET count = count + 1, last_visit = CURRENT_TIMESTAMP WHERE id = 1 RETURNING count, last_visit'
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating visitor count:', error.message);
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      database: dbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  if (url.pathname === '/db') {
    const visitorData = await incrementVisitorCount();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      database: {
        url: databaseUrl ? 'configured' : 'not configured',
        connected: dbConnected,
        message: dbConnected ? 'Successfully connected to PostgreSQL' : 'Database connection failed or not configured',
      },
      visitor: visitorData,
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // Default endpoint - show hello message with visitor count
  const visitorData = await incrementVisitorCount();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Hello from cereal.box!',
    visitorCount: visitorData?.count || 'unavailable',
    lastVisit: visitorData?.last_visit || null,
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  }));
});

// Initialize database and start server
initDatabase().then(() => {
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Database: ${dbConnected ? 'connected' : 'not connected'}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  if (pgClient) {
    await pgClient.end();
  }
  server.close(() => {
    console.log('Server closed');
  });
});
