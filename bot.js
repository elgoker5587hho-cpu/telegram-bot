const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
const axios = require('axios');
const fs = require('fs');

// ====== ضع مفاتيحك هنا ======
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
// ===========================

const bot = new TelegramBot(TELEGRAM_TOKEN, {
  polling: true
});

const client = new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

let memory = {};

if (fs.existsSync('memory.json')) {
  memory = JSON.parse(
    fs.readFileSync('memory.json', 'utf8')
  );
}

function saveMemory() {
  fs.writeFileSync(
    'memory.json',
    JSON.stringify(memory, null, 2)
  );
}

async function searchWeb(query) {
  try {
    const response = await axios.post(
      'https://api.tavily.com/search',
      {
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        max_results: 5
      }
    );

    return response.data.results
      ?.map(
        (r, i) =>
          `${i + 1}. ${r.title}\n${r.content}`
      )
      .join('\n\n') || 'لا توجد نتائج';
  } catch (err) {
    return 'فشل البحث';
  }
}

bot.onText(/\/start/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    '👋 أهلاً! أنا مساعد ذكي. اسألني أي شيء.'
  );
});

bot.onText(/\/search (.+)/, async (msg, match) => {
  const results = await searchWeb(match[1]);

  await bot.sendMessage(
    msg.chat.id,
    results.substring(0, 3500)
  );
});

bot.on('message', async (msg) => {
  
  try {
  if (!msg.text) return;

  if (
    msg.text.startsWith('/start') ||
    msg.text.startsWith('/search')
  ) {
    return;
  }

  const text = msg.text.toLowerCase();

  const userId = msg.chat.id.toString();

  if (!memory[userId]) {
    memory[userId] = [];
  }

  memory[userId].push({
    role: 'user',
    content: msg.text
  });
const currentDate = new Date().toLocaleString('ar-EG', {
  timeZone: 'Africa/Cairo'
});
  const completion =
    await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',

      messages: [
        {
          role: 'system',
 content: `
You are an intelligent AI assistant.

Current date and time: ${currentDate}

Rules:
- You know the current date and time above.
- If asked about today's date, use the date above.
- If asked about the current time, use the time above.
- Never say that you do not know the current date.
- Speak naturally like Meta AI.
- Be friendly and conversational.
- Reply in the same language used by the user.
- Use memory from previous messages.
- Answer accurately and naturally.
`
        },

        ...memory[userId].slice(-10)
      ],

      temperature: 0.5,
      max_tokens: 1200
    });

  const reply =
    completion.choices[0].message.content;

  memory[userId].push({
    role: 'assistant',
    content: reply
  });

  if (memory[userId].length > 30) {
    memory[userId] =
      memory[userId].slice(-30);
  }

  saveMemory();

  await bot.sendMessage(
    msg.chat.id,
    reply
  );

} catch (err) {
  console.log(err);

  await bot.sendMessage(
    msg.chat.id,
    'حدث خطأ أثناء المعالجة.'
  );
}
});

console.log('AI Bot Started');
