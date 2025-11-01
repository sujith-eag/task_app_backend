import express from 'express';

// Legacy stub to satisfy mounts during refactor. Replace with full implementation when available.
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Academic files legacy route (stub)' });
});

export default router;
