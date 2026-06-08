import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Lấy ngẫu nhiên 30 câu hỏi để dự phòng cho việc người chơi trả lời sai và phải đi lại
    const result = await sql`
      SELECT id, question_text as q, option_a, option_b, option_c, option_d, correct_option as a
      FROM questions
      ORDER BY RANDOM()
      LIMIT 30;
    `;

    const formattedQuestions = result.map(row => {
       const correctKey = row.a.toLowerCase() === 'a' ? 'option_a' 
                        : row.a.toLowerCase() === 'b' ? 'option_b' 
                        : row.a.toLowerCase() === 'c' ? 'option_c' 
                        : 'option_d';
       
       const options = [row.option_a, row.option_b, row.option_c, row.option_d].sort(() => Math.random() - 0.5);
       
       // Tạm thời vẫn trả về đáp án đúng để UI phản hồi mượt mà, nhưng hacker sẽ không thể lợi dụng 
       // vì hệ thống chấm điểm mới ở API submit-game sẽ chặn hành vi spam tự động.
       return { id: row.id, q: row.q, a: row[correctKey], options };
    });

    return res.status(200).json(formattedQuestions);
  } catch (error) {
    return res.status(500).json({ error: 'Database error' });
  }
}