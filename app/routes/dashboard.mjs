import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  const { sync } = req.query;
  res.render('dashboard/index', { query: { sync } });
});

export {router}
