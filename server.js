require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// *** 关键修改 1：尝试使用 1206 实验版（在你的列表里！）***
// 如果这个还不行，就改回 "gemini-1.5-flash-latest"
const MODEL_NAME = "gemini-exp-1206"; 

const model = genAI.getGenerativeModel({ 
  model: MODEL_NAME,
  // *** 关键修改 2：删除了 responseMimeType ***
  // 不强制要求 JSON 模式，避免 404 兼容性问题
});

const SYSTEM_PROMPT = `
你是一位 SVG 代码专家。
任务：请根据用户描述，编写一段 SVG 代码。
要求：
1. 直接输出 <svg>...</svg> 代码块，不要包含 markdown 标记（如 \`\`\`xml）。
2. 只使用正红色 (#D90000) 和透明背景。
3. 必须包含 viewBox="0 0 512 512"。
4. 确保代码是纯文本格式，不要包裹在 JSON 里。
`;

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log(`正在使用模型 ${MODEL_NAME} 生成: ${prompt}`);

    const result = await model.generateContent(`${SYSTEM_PROMPT}\n用户需求：${prompt}`);
    const response = await result.response;
    const text = response.text();
    
    // *** 关键修改 3：使用正则表达式暴力提取 SVG ***
    // 这种方式最稳，不管 AI 返回什么格式，只要有 svg 标签就能抓出来
    let svgCode = "";
    const match = text.match(/<svg[\s\S]*?<\/svg>/);
    if (match) {
      svgCode = match[0];
    } else {
      // 如果没提取到，可能 AI 还是输出了 JSON，尝试解析一下
      try {
        const json = JSON.parse(text);
        svgCode = json.svg_code || json.svg;
      } catch (e) {}
    }

    if (!svgCode) {
        console.error("AI 返回原始内容:", text); // 方便在日志里看它到底回了啥
        throw new Error("未能提取到有效的 SVG 代码");
    }

    const base64Svg = Buffer.from(svgCode).toString('base64');
    res.json({ success: true, imageUrl: `data:image/svg+xml;base64,${base64Svg}` });

  } catch (error) {
    console.error("生成失败:", error.message);
    res.json({ success: false, error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`兼容版服务已启动: http://localhost:${PORT}`);
});
