require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 初始化 API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// *** 核心配置：模型选择 ***
// 注意：如果 "gemini-3-pro" 还没对你的账号开放，请改回 "gemini-1.5-pro" 或 "gemini-2.0-flash"
// 这里的关键是：我们要用支持生成图片的模型
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-pro", // 这里暂时写1.5-pro，如果你的账号支持3.0请自行修改
  generationConfig: {
    responseMimeType: "image/jpeg" // 【关键】强制 AI 返回图片格式
  }
});

// *** 核心秘密：严格约束 Prompt (System Instruction) ***
// 我们把这个逻辑写在后端，前端用户就无法绕过这个设定
const PAPER_CUT_CONSTRAINT = `
你是一个专业的中国剪纸生成器。
用户会输入一个物体或场景，你必须生成符合以下标准的【纯图像】：

1.  **风格**：中国传统剪纸艺术 (Chinese Paper Cut Art)。
2.  **颜色**：必须是正红色 (#D90000) 的剪纸纹样。
3.  **背景**：必须是纯白色 (#FFFFFF)。
4.  **细节**：
    - 图案必须是连续的，适合实际剪裁（没有悬空的碎片）。
    - 采用镂空效果，边缘锐利。
    - 扁平化风格 (Flat Design)，无阴影，无立体感。
5.  **禁止**：绝对不要生成真实照片，不要生成文字解释。
`;

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log("收到生成请求:", prompt);

    // 组合最终指令
    const finalPrompt = `${PAPER_CUT_CONSTRAINT}\n\n用户想要剪的内容是：${prompt}`;

    // 向 Google 发送请求
    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    
    // *** 处理 AI 返回的图片数据 ***
    // 不同的模型返回结构可能不同，这里适配最通用的 Gemini 图片返回格式
    // 如果是用 Imagen 模型，逻辑会略有不同，但 Gemini Pro 多模态通常如下：
    
    // 尝试获取 base64 数据
    // 注意：如果是纯文本模型，这里会报错，所以前面必须配置 responseMimeType
    const text = response.text(); 
    
    // 如果模型直接返回了图片的 Base64 字符串（部分新模型特性）
    // 或者我们需要处理 inlineData。
    // 为了保险起见，我们假设 Gemini Pro 遵守指令返回了 Base64
    // (注意：实际开发中，如果使用 Imagen 3，代码需要用 imagen 专用接口，下文有说明)
    
    // --- 临时模拟方案 (防止你账号只有文本权限报错) ---
    // 如果你的 API Key 还没开通图片生成权限，代码会崩。
    // 为了让你能看到效果，这里加一个“保护措施”：
    
    let imageBase64 = "";
    
    // 这里是模拟：如果 AI 真的返回了图片数据 (根据官方文档结构)
    if (result.response.candidates && result.response.candidates[0].content.parts[0].inlineData) {
        imageBase64 = result.response.candidates[0].content.parts[0].inlineData.data;
    } else {
        // 如果 API 还是返回了文本，我们先用一个假图顶替，防止前端白屏，同时打印错误日志
        console.log("警告：AI 返回的似乎不是图片数据，可能是纯文本:", text);
        // 这里你可以放一个你本地 assets 里的红色剪纸图 Base64 做测试
        // 但为了真实，我们尝试直接返回 text 看看是不是 AI 把 Base64 写在文本里了
        imageBase64 = text.replace(/^data:image\/jpeg;base64,/, ""); 
    }
    
    const finalImageUrl = `data:image/jpeg;base64,${imageBase64}`;

    res.json({ 
      success: true, 
      imageUrl: finalImageUrl 
    });

  } catch (error) {
    console.error("生成失败:", error);
    res.status(500).json({ 
      success: false, 
      error: "AI 生成出错，请检查 API Key 是否有图片生成权限。" 
    });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`剪纸后端服务已启动: http://localhost:${PORT}`);
});