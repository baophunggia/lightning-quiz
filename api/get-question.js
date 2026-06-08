import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  
  // Bạn có thể truyền level qua query: /api/get-question?level=1
  const level = req.query.level || 1; 
  
  try {
    const sql = neon(process.env.DATABASE_URL);
    // Giả sử bảng DB của bạn tên 'questions' có cột 'level'
    // Lấy 1 câu ngẫu nhiên theo đúng Level đó
    const result = await sql`
      SELECT id, question_text as q, option_a, option_b, option_c, option_d, correct_option as a
      FROM questions
      WHERE level = ${level}
      ORDER BY RANDOM()
      LIMIT 1;
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'No questions found for this level' });
    }

    const row = result[0];
    
    // Format lại dữ liệu trả về cho Frontend dễ dùng (giống cấu trúc tĩnh cũ)
    const questionData = {
      id: row.id,
      q: row.q,
      a: row[row.a.toLowerCase() === 'a' ? 'option_a' : row.a.toLowerCase() === 'b' ? 'option_b' : row.a.toLowerCase() === 'c' ? 'option_c' : 'option_d'],
      options: [row.option_a, row.option_b, row.option_c, row.option_d]
    };

    return res.status(200).json(questionData);
  } catch (error) {
    console.error('DB Error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
}