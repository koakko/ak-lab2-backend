const express = require('express');
const mysql = require('mysql2/promise');
const { createClient } = require('redis');
require('dotenv').config();

const app = express();

// MySQL connection
async function initMySQL() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'database-container',
    user: process.env.DB_USER || 'dbuser',
    password: process.env.DB_PASS || 'dbpass',
    database: process.env.DB_NAME || 'mydb'
  });
  await connection.execute('CREATE TABLE IF NOT EXISTS messages (id INT AUTO_INCREMENT PRIMARY KEY, content VARCHAR(255))');
  return connection;
}

// Redis connection
async function initRedis() {
  const client = createClient({
    url: `redis://${process.env.REDIS_HOST || 'redis-container'}:6379`
  });
  client.on('error', err => console.log('Redis Error:', err));
  await client.connect();
  return client;
}

// API endpoint
app.get('/', async (req, res) => {
  try {
    const mysqlConn = await initMySQL();
    const redisClient = await initRedis();

    // Store message in MySQL
    await mysqlConn.execute('INSERT INTO messages (content) VALUES (?)', ['Hello from Backend']);
    const [rows] = await mysqlConn.execute('SELECT content FROM messages ORDER BY id DESC LIMIT 1');

    // Store in Redis
    await redisClient.set('last_message', rows[0].content);

    // Get from Redis
    const cachedMessage = await redisClient.get('last_message');

    res.json({ message: cachedMessage || 'No message found' });

    await mysqlConn.end();
    await redisClient.disconnect();
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Backend error' });
  }
});

app.listen(8080, () => console.log('Backend running on port 8080'));