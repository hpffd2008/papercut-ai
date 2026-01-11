require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 初始化 Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 这里我们先填一个最通用的名字，如果错了，下面的代码会自动查正确的
let CURRENT_MODEL_NAME = "gemini-pro"; 

const SYSTEM_PROMPT = `
你是一位 SVG 代码专家。请生成纯 JSON 格式的 SVG 代码。
字段名必须是 "svg_code"。
内容：正红色(#D90000)的剪纸风格图案。
`;

// 辅助函数：查询你的 API Key 到底能用哪些模型
async function getValidModels(apiKey) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    if (data.models) {
      // 过滤出所有名字里带 gemini 的模型
      return data.models
        .filter(m => m.name.includes('gemini'))
        .map(m => m.name.replace('models/', ''))
        .join(', ');
    }
    return "无法获取模型列表";
  } catch (e) {
    return "查询失败";
  }
}

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    // 1. 配置模型
    const model = genAI.getGenerativeModel({ 
      model: CURRENT_MODEL_NAME, 
      generationConfig: { responseMimeType: "application/json" }
    });

    console.log(`尝试使用模型 ${CURRENT_MODEL_NAME} 生成: ${prompt}`);
    const finalPrompt = `${SYSTEM_PROMPT}\n用户需求：${prompt}`;

    // 2. 尝试生成
    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    const text = response.text();
    
    // 3. 解析 SVG
    let svgCode = "";
    try {
      const jsonResponse = JSON.parse(text);
      svgCode = jsonResponse.svg_code;
    } catch (e) {
      const match = text.match(/<svg[\s\S]*?<\/svg>/);
      if (match) svgCode = match[0];
    }

    if (!svgCode) throw new Error("生成了内容但找不到SVG代码");

    const base64Svg = Buffer.from(svgCode).toString('base64');
    res.json({ success: true, imageUrl: `data:image/svg+xml;base64,${base64Svg}` });

  } catch (error) {
    console.error("生成出错:", error.message);

    // *** 关键修改：如果是因为模型找不到 (404)，我们现场查一下能用啥 ***
    if (error.message.includes('404') || error.message.includes('Not Found')) {
      const validModels = await getValidModels(process.env.GEMINI_API_KEY);
      
      // 把查到的结果直接返回给前端报错框
      res.json({ 
        success: false, 
        error: `模型名不对。你的 Key 支持的模型有：${validModels}。请把 server.js 里的 CURRENT_MODEL_NAME 改成其中一个。` 
      });
    } else {
      // 其他错误
      res.json({ success: false, error: error.message });
    }
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`自诊断服务已启动: http://localhost:${PORT}`);
});
