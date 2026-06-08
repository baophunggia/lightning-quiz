import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { telegram_id, username, first_name, max_level, best_score } = req.body;
  
  if(!telegram_id) return res.status(400).json({error: "Missing telegram_id"});

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // 1. Lưu điểm hoặc cập nhật nếu điểm mới cao hơn
    await sql`
      INSERT INTO users (telegram_id, username, first_name, max_level, best_score, games_played, last_played)
      VALUES (${telegram_id}, ${username}, ${first_name}, ${max_level}, ${best_score}, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (telegram_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        max_level = GREATEST(users.max_level, EXCLUDED.max_level),
        best_score = GREATEST(users.best_score, EXCLUDED.best_score),
        games_played = users.games_played + 1,
        last_played = CURRENT_TIMESTAMP;
    `;

    // 2. Lấy Bảng xếp hạng Top 10 (Sắp xếp theo best_score giảm dần)
    const leaderboard = await sql`
      SELECT first_name, max_level, best_score 
      FROM users 
      WHERE best_score > 0
      ORDER BY best_score DESC 
      LIMIT 10;
    `;

    // 3. Tính toán vị trí xếp hạng (Rank) của người chơi hiện tại
    const rankResult = await sql`
      WITH RankedUsers AS (
        SELECT telegram_id, RANK() OVER (ORDER BY best_score DESC) as rank
        FROM users
        WHERE best_score > 0
      )
      SELECT rank FROM RankedUsers WHERE telegram_id = ${telegram_id};
    `;

    const currentRank = rankResult.length > 0 ? rankResult[0].rank : '-';

    // Trả về tất cả data trong 1 lần gọi
    return res.status(200).json({ 
      success: true, 
      leaderboard: leaderboard,
      user_rank: currentRank
    });
  } catch (error) {
    console.error('DB Error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
}