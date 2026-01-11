require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// *** 终极修正：使用 gemini-1.5-pro ***
// 理由：根据你 15:44 的截图，这是唯一一个返回 400 (已连接) 而不是 404 的模型
// 它有免费层级（虽然慢一点点，每分钟限 2 次，但绝对可用）
const MODEL_NAME = "gemini-1.5-pro"; 

const model = genAI.getGenerativeModel({ 
  model: MODEL_NAME,
  // *** 关键：彻底删除 responseMimeType ***
  // 之前的 400 报错就是因为它，删掉后模型就会乖乖听话
});

const SYSTEM_PROMPT = `
你是一位 SVG 代码专家。
任务：根据用户描述，直接编写一段 SVG 代码。

严格要求：
1. 不要输出 markdown 标记（如 \`\`\`xml）。
2. 不要输出任何解释性文字。
3. 直接以 <svg 开头，以 </svg> 结尾。
4. 颜色使用正红色 (#D90000) 和透明背景。
5. 必须包含 viewBox="0 0 512 512"。
`;

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log(`[终极尝试] 正在使用 ${MODEL_NAME} 生成: ${prompt}`);

    const result = await model.generateContent(`${SYSTEM_PROMPT}\n用户需求：${prompt}`);
    const response = await result.response;
    const text = response.text();
    
    // 暴力提取 SVG，不管 AI 说了什么废话，只抓代码
    const match = text.match(/<svg[\s\S]*?<\/svg>/);
    if (!match) {
        console.error("AI 返回内容:", text);
        throw new Error("生成成功但未找到SVG标签");
    }

    const base64Svg = Buffer.from(match[0]).toString('base64');
    res.json({ success: true, imageUrl: `data:image/svg+xml;base64,${base64Svg}` });

  } catch (error) {
    console.error("生成失败:", error.message);
    res.json({ success: false, error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`终极修复服务已启动: http://localhost:${PORT}`);
});
