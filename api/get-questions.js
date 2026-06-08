import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Thuật toán: 
    // 1. Tìm 1 chủ đề ngẫu nhiên cố định cho ngày hôm nay (dùng MD5(category + CURRENT_DATE))
    // 2. Lấy 10 câu hỏi (level 1-10) thuộc chủ đề đó
    const result = await sql`
      WITH DailyCategory AS (
        SELECT category 
        FROM questions
        GROUP BY category
        ORDER BY MD5(category || CURRENT_DATE::text)
        LIMIT 1
      )
      SELECT * FROM (
        SELECT id, level, question_text as q, option_a, option_b, option_c, option_d, correct_option as a, category,
               ROW_NUMBER() OVER(PARTITION BY level ORDER BY MD5(id::text || CURRENT_DATE::text)) as rn
        FROM questions
        WHERE category = (SELECT category FROM DailyCategory)
          AND level <= 10
      ) sub
      WHERE rn = 1
      ORDER BY level;
    `;

    // Map lại dữ liệu và xáo trộn đáp án ngay từ backend
    const formattedQuestions = result.map(row => {
       const correctKey = row.a.toLowerCase() === 'a' ? 'option_a' 
                        : row.a.toLowerCase() === 'b' ? 'option_b' 
                        : row.a.toLowerCase() === 'c' ? 'option_c' 
                        : 'option_d';
       
       const options = [row.option_a, row.option_b, row.option_c, row.option_d].sort(() => Math.random() - 0.5);
       
       return { id: row.id, q: row.q, a: row[correctKey], options };
    });

    // Lấy tên chủ đề của ngày hôm nay để trả về cho Frontend
    const todayTheme = result.length > 0 ? result[0].category : "General";

    // Trả về một Object chứa cả Theme và danh sách câu hỏi
    return res.status(200).json({
      theme: todayTheme,
      questions: formattedQuestions
    });

  } catch (error) {
    console.error('DB Error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
}