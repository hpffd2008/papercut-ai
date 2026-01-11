require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// *** 核心修改 1：回归最强免费模型 ***
// 不需要预览版，不需要 Pro，就用最稳的 Flash
const MODEL_NAME = "gemini-1.5-flash"; 

const model = genAI.getGenerativeModel({ 
  model: MODEL_NAME,
  // *** 核心修改 2：删除了 responseMimeType ***
  // 我们不再强迫模型输出 JSON，这样就不会报 404 错误了！
});

const SYSTEM_PROMPT = `
你是一位中国非物质文化遗产剪纸大师，也是一位 SVG 代码专家。
任务：根据用户描述，编写一段 SVG 代码。

要求：
1. **直接输出代码**：不要包含 markdown 标记（如 \`\`\`xml），不要啰嗦。
2. **视觉风格**：
   - 颜色：只使用正红色 (#D90000) 和透明背景。
   - 必须包含 viewBox="0 0 512 512"。
   - 线条必须连贯闭合。
3. **格式**：确保代码以 <svg 开头，以 </svg> 结尾。
`;

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log(`[免费模式] 正在使用 ${MODEL_NAME} 生成: ${prompt}`);

    const result = await model.generateContent(`${SYSTEM_PROMPT}\n用户需求：${prompt}`);
    const response = await result.response;
    const text = response.text();
    
    // *** 核心修改 3：暴力提取 SVG ***
    // 无论 AI 回复什么废话，我们只抓取 <svg>...</svg> 中间的内容
    const match = text.match(/<svg[\s\S]*?<\/svg>/);
    
    if (!match) {
        console.error("AI 返回内容:", text);
        throw new Error("AI 生成了内容，但没找到 SVG 标签");
    }

    const svgCode = match[0];

    // 转成 Base64 发给前端
    const base64Svg = Buffer.from(svgCode).toString('base64');
    res.json({ success: true, imageUrl: `data:image/svg+xml;base64,${base64Svg}` });

  } catch (error) {
    console.error("生成失败:", error.message);
    res.json({ success: false, error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`免费兼容版服务已启动: http://localhost:${PORT}`);
});
