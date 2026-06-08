import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // Chỉ nhận POST request
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { telegram_id, username, first_name, level_reached } = req.body;

  // Lấy Connection String từ biến môi trường của Vercel
  const sql = neon(process.env.DATABASE_URL);

  try {
    // Lưu hoặc cập nhật điểm số (Upsert)
    const result = await sql`
      INSERT INTO users (telegram_id, username, first_name, max_level, games_played, last_played)
      VALUES (${telegram_id}, ${username}, ${first_name}, ${level_reached}, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (telegram_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        max_level = GREATEST(users.max_level, EXCLUDED.max_level),
        games_played = users.games_played + 1,
        last_played = CURRENT_TIMESTAMP
      RETURNING max_level;
    `;

    return res.status(200).json({ success: true, new_max_level: result[0].max_level });
  } catch (error) {
    console.error('DB Error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
}