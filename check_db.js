const { Client } = require('pg');
const client = new Client({
  host: 'database-1.c5om42i2ygos.ap-south-1.rds.amazonaws.com',
  user: 'postgres',
  password: 'Shrishyam001122',
  database: 'order-to-dispatch',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});
client.connect().then(() => {
  return client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'lift_receiving_confirmation'");
}).then(res => {
  console.log(res.rows.map(r => r.column_name).join(', '));
  process.exit(0);
}).catch(console.error);
