require('dotenv').config();
const express = require('express');
const cors = require('cors');
// 注意：我们不再引入 @google/generative-ai SDK 了
// 直接使用 Node.js 自带的 fetch

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 1. 定义模型：这里用最稳的 gemini-1.5-flash
// 如果想换 pro，就把下面这行改成 "gemini-1.5-pro"
const MODEL_NAME = "gemini-1.5-flash";

const SYSTEM_PROMPT = `
你是一位 SVG 编程专家。
任务：请根据用户描述，编写一段 SVG 代码。
严格要求：
1. 直接输出代码，不要包裹在 markdown (\`\`\`) 里。
2. 不要任何解释文字。
3. 颜色使用正红色 (#D90000) 和透明背景。
4. 必须包含 viewBox="0 0 512 512"。
`;

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log(`[原生请求模式] 正在呼叫 ${MODEL_NAME}...`);

    // 2. 构造原生 HTTP 请求地址
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    // 3. 构造请求体 (Payload)
    // 我们把 System Prompt 和 User Prompt 合并在一起发过去，这样兼容性最强
    const payload = {
      contents: [{
        parts: [{
          text: `${SYSTEM_PROMPT}\n\n用户需求：${prompt}`
        }]
      }]
    };

    // 4. 发送原生请求
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // 5. 错误处理：如果 Google 返回错误，直接打印出来
    if (!response.ok) {
      console.error("Google API 报错详情:", JSON.stringify(data, null, 2));
      throw new Error(data.error?.message || "Google API 请求失败");
    }

    // 6. 提取文本结果
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) {
      throw new Error("AI 返回了空内容");
    }

    // 7. 暴力提取 SVG (不管 AI 怎么回答，只抓代码)
    const match = aiText.match(/<svg[\s\S]*?<\/svg>/);
    if (!match) {
      console.error("AI 原始回复:", aiText);
      throw new Error("未能从 AI 回复中提取到 SVG 标签");
    }

    const svgCode = match[0];
    const base64Svg = Buffer.from(svgCode).toString('base64');
    
    // 成功！
    res.json({ success: true, imageUrl: `data:image/svg+xml;base64,${base64Svg}` });

  } catch (error) {
    console.error("后端处理出错:", error.message);
    res.json({ success: false, error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`原生 Fetch 服务已启动 (端口 ${PORT})`);
});
