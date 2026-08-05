export class AiService {
  constructor(
    private ai: any,
    private menuContext: string
  ) {}

  async processQuery(query: string, userId: string, recentLogs: any[]): Promise<string> {
    if (recentLogs.length > 0) {
      const lastMessageTime = new Date(recentLogs[0].timestamp).getTime();
      const now = new Date().getTime();
      if (now - lastMessageTime < 5000) {
        return "⏳ لطفاً چند ثانیه صبر کنید و دوباره سؤال بپرسید.";
      }
    }

    const systemPrompt = `You are a coffee assistant for Azadi Coffee Roastery (Iranshahr, Iran).
Answer ONLY coffee/menu/branch questions. Reply in the user's language. Prices in Tomans. Be brief.
${this.menuContext}`;

    const historyMessages = recentLogs.slice(-3).reverse().flatMap(log => [
      { role: 'user', content: log.question },
      { role: 'assistant', content: log.response }
    ]);

    try {
      const response = await this.ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: query }
        ],
        max_tokens: 512
      });
      const answer = response.response ?? "⚠️ متأسفانه در پاسخگویی مشکلی پیش آمد. لطفاً دوباره تلاش کنید.";
      return answer;
    } catch (e: any) {
      console.error(e);
      return "⚠️ متأسفانه در پاسخگویی مشکلی پیش آمد. لطفاً دوباره تلاش کنید.";
    }
  }
}
