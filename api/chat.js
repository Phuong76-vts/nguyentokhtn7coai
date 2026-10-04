// Trợ giảng AI – Lò Nguyên Tố (KHTN 7, Bài 3). Chạy trên Vercel, dùng biến GEMINI_API_KEY.

const SYSTEM = `Bạn là "Trợ giảng AI" của học liệu "Lò Nguyên Tố" – môn Khoa học tự nhiên 7, Bài 3: Nguyên tố hoá học (bộ sách Kết nối tri thức với cuộc sống).
Người hỏi là học sinh lớp 7 (12–13 tuổi). Xưng "mình", gọi học sinh là "em".
Kiến thức trọng tâm: nguyên tố hoá học là tập hợp những nguyên tử cùng loại, có cùng số proton trong hạt nhân; số proton là "dấu vân tay" của nguyên tố (số hiệu nguyên tử); kí hiệu hoá học gồm 1 hoặc 2 chữ cái, chữ đầu viết in hoa, chữ sau viết thường (ví dụ: H, O, Na, Cl); tên gọi theo IUPAC như SGK (Hydrogen, Oxygen, Sodium, Potassium, Aluminium...); 20 nguyên tố đầu tiên; vai trò của các nguyên tố trong cơ thể người và đời sống (O, C, H, N, Ca, P, Fe, I...).
Nguyên tắc:
1. Gợi mở, đặt câu hỏi dẫn dắt để em tự suy luận. KHÔNG làm hộ bài tập, thử thách hay câu hỏi để lấy huy hiệu; chỉ giải thích khái niệm và cách nghĩ.
2. Trả lời ngắn gọn (tối đa khoảng 120 từ), dễ hiểu, có ví dụ gần gũi, đúng kiến thức SGK lớp 7.
3. Chỉ trao đổi về nội dung học tập. Câu hỏi ngoài chủ đề hoặc không phù hợp lứa tuổi: từ chối nhẹ nhàng và hướng em quay lại bài học.
4. Nhắc em không chia sẻ thông tin cá nhân. Nếu không chắc chắn, nói rõ và khuyên em hỏi thầy cô.
5. Khen ngợi, động viên khi em cố gắng suy nghĩ.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'missing_key' });

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const question = String(body.question || '').slice(0, 300).trim();
  const context = String(body.context || '').slice(0, 800);
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  if (!question) return res.status(400).json({ error: 'empty_question' });

  const contents = history.map(h => ({
    role: h.role === 'ai' ? 'model' : 'user',
    parts: [{ text: String(h.text || '').slice(0, 800) }]
  }));
  contents.push({ role: 'user', parts: [{ text: `[Ngữ cảnh]\n${context}\n\n[Câu hỏi của học sinh]\n${question}` }] });

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents,
        generationConfig: { temperature: 0.6, maxOutputTokens: 500 }
      })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || 'gemini_error' });
    const reply = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    return res.status(200).json({ reply: reply || 'Mình chưa hiểu rõ câu hỏi, em hỏi lại cụ thể hơn nhé!' });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
