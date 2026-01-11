require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// *** 修改点 1：使用带版本号的精确名字 ***
// 尝试使用最稳定的版本号
const MODEL_NAME = "gemini-1.5-flash-001"; 

const model = genAI.getGenerativeModel({ 
  model: MODEL_NAME, 
  generationConfig: {
    responseMimeType: "application/json"
  }
});

const SYSTEM_PROMPT = `
你是一位中国非物质文化遗产剪纸大师，也是一位 SVG 代码专家。
任务：根据用户描述，编写一段 SVG 代码来呈现剪纸效果。
严格要求：纯 JSON 格式，包含 "svg_code" 字段。只用红色 (#D90000) 和透明背景。viewBox="0 0 512 512"。
`;

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log(`收到请求: ${prompt}, 正在使用模型: ${MODEL_NAME}`);

    const finalPrompt = `${SYSTEM_PROMPT}\n\n用户想要的内容是：${prompt}`;
    
    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    const text = response.text();
    
    let svgCode = "";
    try {
      const jsonResponse = JSON.parse(text);
      svgCode = jsonResponse.svg_code;
    } catch (e) {
      const match = text.match(/<svg[\s\S]*?<\/svg>/);
      if (match) svgCode = match[0];
    }

    if (!svgCode) throw new Error("AI 未能生成有效的 SVG 代码");

    const base64Svg = Buffer.from(svgCode).toString('base64');
    const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;

    res.json({ success: true, imageUrl: dataUrl });

  } catch (error) {
    console.error("生成失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// *** 修改点 2：启动时自动打印可用模型列表 ***
// 这样如果失败了，看日志就知道你该用哪个名字了
async function listAvailableModels() {
  try {
    // 注意：这里使用 fetch 直接查询，绕过 SDK 可能的版本限制
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    console.log("\n====== 你的 API Key 支持的模型列表 ======");
    if (data.models) {
      data.models.forEach(m => {
        if (m.name.includes('gemini')) console.log(`✅ ${m.name.replace('models/', '')}`);
      });
    } else {
      console.log("无法获取模型列表:", data);
    }
    console.log("========================================\n");
  } catch (e) {
    console.error("自检失败:", e);
  }
}

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`服务已启动: http://localhost:${PORT}`);
  // 启动时查一下户口
  listAvailableModels();
});
