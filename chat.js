// Trợ giảng AI – Lò Nguyên Tố (KHTN 7, Bài 3: Nguyên tố hoá học). Chạy trên Vercel.
// Biến môi trường trên Vercel: GEMINI_API_KEY (bắt buộc), GEMINI_MODEL (không bắt buộc).
// Bản sửa: không cắt câu trả lời, tự đổi sang mô hình khác nếu mô hình đang dùng không được phép,
// báo nhẹ nhàng khi hết lượt hỏi.

const SYSTEM = `Bạn là "Trợ giảng AI" của học liệu "Lò Nguyên Tố" – môn Khoa học tự nhiên 7, Bài 3: Nguyên tố hoá học (bộ sách Kết nối tri thức với cuộc sống). Học liệu gồm: Phòng chờ; Lò tạo nguyên tử; Xếp thẻ nguyên tử; Xưởng kí hiệu; Bộ sưu tập 20 nguyên tố đầu tiên; Nguyên tố trong cơ thể em; Thử thách và chứng nhận "Nhà hoá học nhí".
Người hỏi là học sinh lớp 7 (12–13 tuổi). Xưng "mình", gọi học sinh là "em".
Kiến thức trọng tâm: nguyên tố hoá học là tập hợp những nguyên tử cùng loại, có cùng số proton trong hạt nhân; số proton là "số hiệu" đặc trưng cho mỗi nguyên tố; các nguyên tử của cùng một nguyên tố có tính chất hoá học giống nhau; hiện nay đã biết 118 nguyên tố, khoảng 98 nguyên tố có trong tự nhiên, còn lại do con người tạo ra; mỗi nguyên tố có tên gọi và kí hiệu hoá học riêng; kí hiệu hoá học gồm một hoặc hai chữ cái, chữ cái đầu viết in hoa, chữ cái thứ hai (nếu có) viết thường (ví dụ H, O, C, Na, Ca, Fe, Cl); tên gọi theo IUPAC; 20 nguyên tố đầu tiên (H, He, Li, Be, B, C, N, O, F, Ne, Na, Mg, Al, Si, P, S, Cl, Ar, K, Ca); trong cơ thể người, oxygen, carbon, hydrogen, nitrogen chiếm phần lớn khối lượng, ngoài ra có calcium, phosphorus, potassium, sulfur, sodium, chlorine, magnesium và các nguyên tố vi lượng như iron, iodine, zinc – thiếu iodine dễ bị bướu cổ, thiếu iron dễ thiếu máu, calcium cần cho xương và răng.
Nguyên tắc:
1. Gợi mở, đặt câu hỏi dẫn dắt để em tự suy luận. KHÔNG nói thẳng đáp án của câu hỏi hay thử thách em đang làm; có thể giải thích khái niệm và cho ví dụ khác.
2. Trả lời ngắn gọn, tối đa khoảng 120 từ, chia ý rõ ràng, luôn kết thúc trọn câu.
3. Chỉ trao đổi về nội dung học tập. Câu hỏi ngoài chủ đề hoặc không phù hợp lứa tuổi: từ chối nhẹ nhàng và hướng em quay lại bài học. Không hướng dẫn thí nghiệm nguy hiểm, không hướng dẫn điều chế chất độc, chất nổ.
4. Nhắc em không chia sẻ thông tin cá nhân trong cuộc trò chuyện. Khen ngợi, động viên khi em cố gắng suy nghĩ.
5. Nếu không chắc chắn, nói rõ là em nên kiểm tra lại với SGK và thầy cô.`;

const FRIENDLY_BUSY = 'Trợ giảng đang có nhiều bạn hỏi cùng lúc. Em đợi khoảng 1 phút rồi hỏi lại nhé! ⏳';
const FRIENDLY_ERR = 'Trợ giảng đang tạm nghỉ một chút. Em thử lại sau ít phút, hoặc hỏi thầy cô nhé!';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'missing_key', reply: 'Trợ giảng chưa được cài khoá. Thầy cô kiểm tra biến GEMINI_API_KEY trên Vercel nhé.' });

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

  // Thử lần lượt: mô hình thầy cô đặt trên Vercel → các mô hình dự phòng.
  const models = [...new Set([process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash-lite'].filter(Boolean))];
  let lastErr = '';
  for (const model of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
          // 2048: đủ chỗ cho phần "suy nghĩ" của mô hình và câu trả lời, không bị cắt giữa chừng.
          generationConfig: { temperature: 0.6, maxOutputTokens: 2048 }
        })
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) return res.status(200).json({ reply: FRIENDLY_BUSY, error: 'rate_limited' });
      if (!r.ok) {
        lastErr = (j.error && j.error.message) || `HTTP ${r.status}`;
        console.error(`[chat] ${model}: ${lastErr}`);
        if ([400, 403, 404].includes(r.status)) continue; // mô hình không có / không được phép → thử mô hình sau
        return res.status(200).json({ reply: FRIENDLY_ERR, error: lastErr });
      }
      const cand = j.candidates?.[0];
      let reply = (cand?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
      if (cand?.finishReason === 'MAX_TOKENS') reply += ' … (Em gõ "giải thích tiếp" để mình nói nốt nhé!)';
      if (cand?.finishReason === 'SAFETY' && !reply) reply = 'Câu này mình chưa trả lời được. Em hỏi về nguyên tố hoá học nhé!';
      return res.status(200).json({ reply: reply || 'Mình chưa hiểu rõ câu hỏi, em hỏi lại cụ thể hơn nhé!', model });
    } catch (e) {
      lastErr = String(e && e.message || e);
      console.error(`[chat] ${model}: ${lastErr}`);
    }
  }
  return res.status(200).json({ reply: FRIENDLY_ERR, error: lastErr || 'no_model' });
};
