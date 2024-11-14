const { Pool } = require('pg');

const connectionString = 'postgresql://postgres:lVJJvYxUdcjEawNJafdsiYaONYYVhkmr@junction.proxy.rlwy.net:12172/railway';

const pool = new Pool({
  connectionString: connectionString,
});

module.exports = pool;