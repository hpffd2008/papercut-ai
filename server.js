require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 默认先试一个最稳的，如果不行，下面的代码会救场
let MODEL_NAME = "gemini-2.0-flash-exp"; 

const SYSTEM_PROMPT = `
你是一位 SVG 代码专家。请生成纯 JSON 格式的 SVG 代码。
字段名必须是 "svg_code"。内容：正红色(#D90000)的剪纸风格图案。
`;

app.post('/api/generate', async (req, res) => {
  console.log("----------------------------------------");
  console.log("1. 收到请求，准备进行【权限自检】...");

  try {
    // *** 强制自检步骤：直接问 Google 我能用啥 ***
    // 这一步会把你的“家底”全部打印在 Render 日志里，别错过！
    const listReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const listData = await listReq.json();
    
    console.log("2. Google 返回的【可用模型列表】：");
    if (listData.models) {
        listData.models.forEach(m => {
            // 只打印 gemini 系列
            if (m.name.includes('gemini')) {
                console.log(`   ✅ ${m.name.replace('models/', '')}`);
            }
        });
    } else {
        console.log("   ❌ 无法获取列表，可能 API Key 无效或未开通 Google AI Studio 服务。");
        console.log("   错误详情:", JSON.stringify(listData));
    }
    console.log("----------------------------------------");

    // 正常生成流程
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME, 
      generationConfig: { responseMimeType: "application/json" }
    });

    const finalPrompt = `${SYSTEM_PROMPT}\n用户需求：${req.body.prompt}`;
    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    const text = response.text();
    
    // 解析 SVG
    let svgCode = "";
    try {
      const jsonResponse = JSON.parse(text);
      svgCode = jsonResponse.svg_code;
    } catch (e) {
      const match = text.match(/<svg[\s\S]*?<\/svg>/);
      if (match) svgCode = match[0];
    }

    if (!svgCode) throw new Error("SVG 代码提取失败");

    const base64Svg = Buffer.from(svgCode).toString('base64');
    res.json({ success: true, imageUrl: `data:image/svg+xml;base64,${base64Svg}` });

  } catch (error) {
    console.error("生成出错:", error.message);
    res.json({ 
      success: false, 
      // 告诉前端去哪里看答案
      error: "模型调用失败。请去 Render 网页看 Logs (日志)，我已把所有可用的模型名字打印在那里了！" 
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`侦探服务已启动: http://localhost:${PORT}`);
});
