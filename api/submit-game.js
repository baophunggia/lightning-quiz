import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  // logs: mảng chứa { questionId, selectedAns, timestamp }
  const { telegram_id, username, first_name, logs, startTime } = req.body;

  if (!telegram_id || !logs)
    return res.status(400).json({ error: "Missing data" });

  try {
    const sql = neon(process.env.DATABASE_URL);

    // 1. FIX CHỐNG GIAN LẬN: Chỉ dùng thời gian nội bộ của Client để tránh lệch giờ máy chủ
    let clientPlayDuration = 0;
    if (logs.length > 0) {
      // Lấy thời gian lúc trả lời câu cuối trừ đi lúc bắt đầu
      clientPlayDuration = logs[logs.length - 1].timestamp - startTime;
    }

    // Cho phép tối đa 70s (60s chơi + 10s bù trừ độ trễ mạng/chuyển câu hỏi)
    if (clientPlayDuration > 70000) {
      return res.status(400).json({ error: "Time manipulation detected" });
    }

    // 2. Lấy đáp án chuẩn từ DB để đối chiếu
    const questionIds = logs.map((l) => l.questionId);
    let correctAnswers = {};

    if (questionIds.length > 0) {
      const dbQuestions = await sql`
          SELECT id, option_a, option_b, option_c, option_d, correct_option 
          FROM questions WHERE id = ANY(${questionIds})
        `;

      dbQuestions.forEach((q) => {
        const key =
          q.correct_option.toLowerCase() === "a" ? "option_a"
            : q.correct_option.toLowerCase() === "b" ? "option_b"
            : q.correct_option.toLowerCase() === "c" ? "option_c"
            : "option_d";
        correctAnswers[q.id] = q[key];
      });
    }

    // 3. TỰ TÍNH ĐIỂM TRÊN SERVER (Replay Simulation)
    let currentStreak = 0;
    let maxStreak = 0;
    let lastClickTime = startTime;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // Chống auto-click bot: Nếu thời gian giữa 2 câu < 400ms -> Đánh dấu spam
      if (log.timestamp - lastClickTime < 400) continue;

      if (correctAnswers[log.questionId] === log.selectedAns) {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
        if (maxStreak >= 10) break; // Thắng tuyệt đối
      } else {
        currentStreak = 0; // Sai -> Reset chuỗi
      }
      lastClickTime = log.timestamp;
    }

    const finalScore = maxStreak * 10000;

    // 4. FIX DB: Đã thêm last_played vào INSERT
    await sql`
      INSERT INTO users (
        telegram_id, username, first_name, max_level, best_score, games_played, 
        last_play_date, plays_today, current_streak, last_played
      )
      VALUES (
        ${telegram_id}, ${username}, ${first_name}, ${maxStreak}, ${finalScore}, 1, 
        CURRENT_DATE, 1, 1, CURRENT_TIMESTAMP
      )
      ON CONFLICT (telegram_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        max_level = GREATEST(users.max_level, EXCLUDED.max_level),
        best_score = GREATEST(users.best_score, EXCLUDED.best_score),
        games_played = users.games_played + 1,
        
        -- Reset số lượt nếu là ngày mới, ngược lại cộng dồn
        plays_today = CASE 
                        WHEN users.last_play_date < CURRENT_DATE THEN 1 
                        ELSE users.plays_today + 1 
                      END,
                      
        -- Tính toán Streak
        current_streak = CASE 
                           WHEN users.last_play_date = CURRENT_DATE - INTERVAL '1 day' THEN users.current_streak + 1
                           WHEN users.last_play_date = CURRENT_DATE THEN users.current_streak 
                           ELSE 1 
                         END,
                         
        last_play_date = CURRENT_DATE,
        last_played = CURRENT_TIMESTAMP;
    `;

    // 5. Lấy Leaderboard
    const leaderboard = await sql`
      SELECT first_name, max_level, best_score 
      FROM users 
      WHERE best_score > 0 
      ORDER BY best_score DESC 
      LIMIT 10;
    `;
    
    const rankResult = await sql`
      WITH RankedUsers AS (
        SELECT telegram_id, RANK() OVER (ORDER BY best_score DESC) as rank 
        FROM users 
        WHERE best_score > 0
      ) 
      SELECT rank FROM RankedUsers WHERE telegram_id = ${telegram_id};
    `;

    const userStats = await sql`
      SELECT plays_today, current_streak 
      FROM users 
      WHERE telegram_id = ${telegram_id};
    `;

    return res.status(200).json({
      success: true,
      final_streak: maxStreak,
      final_score: finalScore,
      leaderboard: leaderboard,
      user_rank: rankResult.length > 0 ? rankResult[0].rank : "-",
      plays_today: userStats[0]?.plays_today || 1,
      current_streak: userStats[0]?.current_streak || 1,
    });
    
  } catch (error) {
    console.error("API Error:", error);
    // Trả về chi tiết lỗi để dễ debug nếu cấu hình DB sai
    return res.status(500).json({ error: "Server error", details: error.message }); 
  }
}