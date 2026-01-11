require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 使用 Gemini 1.5 Pro，但这次我们要求它输出 JSON（纯文本）
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  generationConfig: {
    responseMimeType: "application/json" // 关键修改：告诉 AI 我要数据，不要图片文件
  }
});

const SYSTEM_PROMPT = `
你是一位中国非物质文化遗产剪纸大师，也是一位 SVG 代码专家。
任务：根据用户描述，编写一段 SVG 代码来呈现剪纸效果。

严格要求：
1.  **输出格式**：必须是纯 JSON 格式，包含一个字段 "svg_code"。
2.  **视觉风格**：
    - 颜色：只能使用正红色 (#D90000) 和透明背景。
    - 必须包含 viewBox="0 0 512 512"。
    - 图案必须是连贯的（剪纸风格），不要有破碎的线条。
    - 风格：扁平、民俗、对称或平衡构图。
3.  **代码要求**：SVG 代码必须精简、有效，可以直接在浏览器渲染。
`;

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log("收到请求，正在设计 SVG 剪纸:", prompt);

    const finalPrompt = `${SYSTEM_PROMPT}\n\n用户想要的内容是：${prompt}`;

    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    const text = response.text();
    
    // 解析 AI 返回的 JSON
    let svgCode = "";
    try {
      const jsonResponse = JSON.parse(text);
      svgCode = jsonResponse.svg_code;
    } catch (e) {
      console.error("JSON解析失败，尝试手动提取", e);
      // 兜底策略：如果 AI 没返回完美 JSON，尝试提取 svg 标签
      const match = text.match(/<svg[\s\S]*?<\/svg>/);
      if (match) svgCode = match[0];
    }

    if (!svgCode) {
      throw new Error("AI 未能生成有效的 SVG 代码");
    }

    // *** 魔法步骤 ***
    // 把 SVG 代码转换成浏览器能看懂的“图片链接” (Base64)
    // 这样前端(Create.tsx)根本不需要改代码，以为自己收到的是张图片
    const base64Svg = Buffer.from(svgCode).toString('base64');
    const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;

    res.json({ 
      success: true, 
      imageUrl: dataUrl 
    });

  } catch (error) {
    console.error("生成失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`SVG 剪纸后端已启动: http://localhost:${PORT}`);
});
