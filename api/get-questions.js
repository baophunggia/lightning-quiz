// File: api/get-questions.js
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Query lấy ngẫu nhiên 1 câu hỏi cho MỖI level (từ 1 đến 10)
    const result = await sql`
      SELECT * FROM (
        SELECT id, level, question_text as q, option_a, option_b, option_c, option_d, correct_option as a,
               ROW_NUMBER() OVER(PARTITION BY level ORDER BY RANDOM()) as rn
        FROM questions
        WHERE level <= 10
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

    return res.status(200).json(formattedQuestions);
  } catch (error) {
    console.error('DB Error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
}