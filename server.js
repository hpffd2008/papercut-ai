require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// *** 核心修改 1：使用最稳的正式版模型 ***
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
    console.log(`[v1 正式版模式] 正在呼叫 ${MODEL_NAME}...`);

    // *** 核心修改 2：把 v1beta 改成了 v1 ***
    // 只有 v1 接口才能稳定访问 gemini-1.5-flash 的免费额度
    const url = `https://generativelanguage.googleapis.com/v1/models/${MODEL_NAME}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const payload = {
      contents: [{
        parts: [{
          text: `${SYSTEM_PROMPT}\n\n用户需求：${prompt}`
        }]
      }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Google API 报错:", JSON.stringify(data, null, 2));
      // 如果这次还报错，我会把具体原因打印出来
      throw new Error(data.error?.message || "请求失败");
    }

    // 提取内容
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) throw new Error("AI 返回内容为空");

    // 提取 SVG
    const match = aiText.match(/<svg[\s\S]*?<\/svg>/);
    if (!match) throw new Error("未找到 SVG 标签");

    const base64Svg = Buffer.from(match[0]).toString('base64');
    res.json({ success: true, imageUrl: `data:image/svg+xml;base64,${base64Svg}` });

  } catch (error) {
    console.error("处理出错:", error.message);
    res.json({ success: false, error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`v1 正式版服务已启动: http://localhost:${PORT}`);
});
