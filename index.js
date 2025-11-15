const express = require('express')
const { searchAliExpress } = require('./aliutils')
const app = express()
const port = 3000

app.get('/', (req, res) => {  
  res.send('API is running!')
})

app.get('/search', async (req, res) => {
  try {
    const { q, page, sort } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query parameter "q" is required' });
    }

    const results = await searchAliExpress({
      q,
      page: page ? parseInt(page) : 1 || 'default',
      sort: sort || 'default'
    });

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
