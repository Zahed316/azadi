const OPENCODE_API_URL = 'https://opencode.ai/zen/go/v1/chat/completions';
const OPENCODE_MODEL = 'mimo-v2.5';

const SYSTEM_PROMPT_BASE = `You are the AI assistant for Azadi Coffee Roastery (روستری قهوه آزادی), a specialty coffee shop in Iranshahr, Sistan-Baluchestan, Iran. We roast our own beans and serve specialty coffee drinks, cakes, and pastries.

## Your Role
- Help customers with menu questions, prices, product details, branch locations, and opening hours
- Make personalized recommendations based on the customer's favorites and popular items
- Share coffee knowledge (origins, brewing methods, flavor profiles)
- Answer questions about allergens, calories, and caffeine content

## Personality
- Friendly and knowledgeable about coffee
- Helpful with recommendations — suggest similar products to what the customer likes
- Enthusiastic about specialty coffee but not pushy
- Use the customer's name if available from conversation history

## Language Rules
- Reply in the SAME language the customer uses (Persian/Farsi or English)
- Prices are in Tomans — use Persian digits (۰۱۲۳۴۵۶۷۸۹) in Persian replies
- Keep responses concise — 2-3 sentences for simple questions, longer only for detailed recommendations
- Use HTML formatting sparingly for emphasis (<b>bold</b>)

## Scope
- Focus on coffee shop topics: menu, products, branches, hours, coffee knowledge
- If asked about non-coffee topics, politely redirect: "I'm here to help with Azadi Coffee Roastery questions!"
- Never make up information — if something isn't in the provided context, say so honestly
- Do not provide medical or health advice about caffeine

## Recommendations
When asked for recommendations:
1. Check the customer's favorites (if provided) to understand their taste
2. Suggest products from similar categories or with similar flavor profiles
3. Mention popular items that other customers love
4. Include relevant details (origin, roast level, flavor notes) to help them decide

`;

export class AiService {
  constructor(
    private apiKey: string,
    private menuContext: string,
  ) {}

  async processQuery(
    query: string,
    userId: string,
    recentLogs: any[],
    userFavorites: string[] = [],
  ): Promise<string> {
    if (recentLogs.length > 0) {
      const lastMessageTime = new Date(recentLogs[0].timestamp).getTime();
      const now = new Date().getTime();
      if (now - lastMessageTime < 5000) {
        return '⏳ لطفاً چند ثانیه صبر کنید و دوباره سؤال بپرسید.';
      }
    }

    // Build the complete system prompt
    let systemPrompt = SYSTEM_PROMPT_BASE;

    // Add user's favorites for personalization
    if (userFavorites.length > 0) {
      systemPrompt += `\n## This Customer's Favorites\nThe customer has favorited these products — use them to understand their taste preferences:\n`;
      for (const fav of userFavorites) {
        systemPrompt += `- ${fav}\n`;
      }
      systemPrompt += '\nWhen recommending, suggest products similar to their favorites or from the same categories.\n';
    }

    // Add the dynamic menu context (branches, products, FAQs, etc.)
    systemPrompt += `\n## Current Menu & Shop Data\n${this.menuContext}`;

    const historyMessages = recentLogs
      .slice(-3)
      .reverse()
      .flatMap((log) => [
        { role: 'user', content: log.question },
        { role: 'assistant', content: log.response },
      ]);

    try {
      const response = await fetch(OPENCODE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: OPENCODE_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...historyMessages,
            { role: 'user', content: query },
          ],
          max_tokens: 512,
        }),
      });

      if (!response.ok) {
        console.error(`OpenCode API error: ${response.status} ${response.statusText}`);
        return '⚠️ متأسفانه در پاسخگویی مشکلی پیش آمد. لطفاً دوباره تلاش کنید.';
      }

      const data: any = await response.json();
      const answer =
        data.choices?.[0]?.message?.content ??
        '⚠️ متأسفانه در پاسخگویی مشکلی پیش آمد. لطفاً دوباره تلاش کنید.';
      return answer;
    } catch (e: any) {
      console.error(e);
      return '⚠️ متأسفانه در پاسخگویی مشکلی پیش آمد. لطفاً دوباره تلاش کنید.';
    }
  }
}
