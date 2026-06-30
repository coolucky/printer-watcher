
const express = require('express');
const path = require('path');

const app = express();
const port = 5173;

app.use(express.static(path.join(__dirname, '../')));

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});