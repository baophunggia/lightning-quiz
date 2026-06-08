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

    // 1. CHỐNG GIAN LẬN: Kiểm tra thời gian chơi có hợp lý không (Quá 65s là gian lận)
    const playDuration = Date.now() - startTime;
    if (playDuration > 65000) {
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
          q.correct_option.toLowerCase() === "a"
            ? "option_a"
            : q.correct_option.toLowerCase() === "b"
              ? "option_b"
              : q.correct_option.toLowerCase() === "c"
                ? "option_c"
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

    const finalScore = maxStreak * 10000; // Có thể cộng thêm bonus time nếu maxStreak = 10

    // 4. Lưu dữ liệu an toàn xuống DB
    await sql`
      INSERT INTO users (telegram_id, username, first_name, max_level, best_score, games_played, last_played)
      VALUES (${telegram_id}, ${username}, ${first_name}, ${maxStreak}, ${finalScore}, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (telegram_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        max_level = GREATEST(users.max_level, EXCLUDED.max_level),
        best_score = GREATEST(users.best_score, EXCLUDED.best_score),
        games_played = users.games_played + 1,
        last_played = CURRENT_TIMESTAMP;
    `;

    // 5. Lấy Leaderboard
    const leaderboard =
      await sql`SELECT first_name, max_level, best_score FROM users WHERE best_score > 0 ORDER BY best_score DESC LIMIT 10;`;
    const rankResult =
      await sql`WITH RankedUsers AS (SELECT telegram_id, RANK() OVER (ORDER BY best_score DESC) as rank FROM users WHERE best_score > 0) SELECT rank FROM RankedUsers WHERE telegram_id = ${telegram_id};`;

    return res.status(200).json({
      success: true,
      final_streak: maxStreak,
      final_score: finalScore,
      leaderboard: leaderboard,
      user_rank: rankResult.length > 0 ? rankResult[0].rank : "-",
    });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
}
