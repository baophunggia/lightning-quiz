// File: api/init-user.js
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

// Hàm xác thực chữ ký dữ liệu từ Telegram phát sinh bằng Bot Token
function verifyTelegramWebAppData(initData, botToken) {
  if (!initData) return false;
  
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  // Sắp xếp các tham số theo bảng chữ cái
  const dataCheckArr = [];
  for (const [key, value] of urlParams.entries()) {
    dataCheckArr.push(`${key}=${value}`);
  }
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join('\n');

  // Thực hiện hash SHA256 song song theo tài liệu Telegram cung cấp
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return calculatedHash === hash;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { initData } = req.body;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // Cấu hình Token này trên Vercel Env

  // Cho phép bỏ qua xác thực nếu chạy ở môi trường localhost (Development) để dễ test
  const isValid = verifyTelegramWebAppData(initData, BOT_TOKEN) || process.env.NODE_ENV === 'development';

  if (!isValid) {
    return res.status(401).json({ error: 'Dữ liệu không hợp lệ hoặc bị giả mạo.' });
  }

  // Giải mã thông tin user từ chuỗi initData
  const urlParams = new URLSearchParams(initData);
  const userRaw = urlParams.get('user');
  if (!userRaw) return res.status(400).json({ error: 'Không tìm thấy thông tin user.' });
  
  const tgUser = JSON.parse(userRaw);

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Truy vấn lấy dữ liệu hoặc tạo mới nếu user lần đầu đăng nhập.
    // Tự động kiểm tra reset lượt chơi hàng ngày nếu ngày cuối cùng chơi nhỏ hơn ngày hiện tại.
    const result = await sql`
      INSERT INTO users (telegram_id, username, first_name, last_play_date, plays_today, current_streak)
      VALUES (${tgUser.id}, ${tgUser.username || 'unknown'}, ${tgUser.first_name}, CURRENT_DATE, 0, 0)
      ON CONFLICT (telegram_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        plays_today = CASE 
                        WHEN users.last_play_date < CURRENT_DATE THEN 0 
                        ELSE users.plays_today 
                      END,
        current_streak = CASE 
                           WHEN users.last_play_date < CURRENT_DATE - INTERVAL '1 day' THEN 0 
                           ELSE users.current_streak 
                         END
      RETURNING plays_today, current_streak, max_level, best_score;
    `;

    return res.status(200).json(result[0]);
  } catch (error) {
    console.error('Init DB Error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
}