import { Context, Subreddit, TriggerContext } from '@devvit/public-api';

export async function fetchRecentPostTitles(context: Context | TriggerContext, subreddit: string) {
  try {
    // Get the current subreddit
    // const subreddit = await context.reddit.getCurrentSubreddit();
    
    // Get new posts from the subreddit using context.reddit
    const posts = await context.reddit.getNewPosts({
      subredditName: subreddit,
      // subredditName: subreddit.name,
      limit: 30
    }).all();
    
    // Filter posts from the last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentPosts = posts.filter(post => post.createdAt.getTime() > oneDayAgo);
    
    // Extract titles from recent posts
    const titles = recentPosts.map(post => post.title);
    
    console.log('Recent post titles:', titles);
    return titles;
  } catch (error) {
    console.error('Error fetching recent posts:', error);
    throw error;
  }
}

export async function useGemini(context: TriggerContext, prompt: string) {
  try {
    const apiKey = await context.settings.get('gemini-api-key');

    if (typeof apiKey !== 'string' || apiKey.trim() === '') {
        throw new Error('Gemini API key is not set or is invalid');
    }

    console.log('API Key Status: Key Present');
    console.log('Full Prompt:', prompt);

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: prompt }],
          role: 'user'
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200,
          topK: 40,
          topP: 0.95
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    const words = generatedText
      .split(/[,\s]+/)
      // .map(word => word.trim().toUpperCase())
      // .filter(word => 
      //   word.length >= 2 && 
      //   word.length <= 10 && 
      //   /^[A-Z]+$/.test(word)
      // )
      // .slice(0, 10);

    console.log('Generated Words:', words);
    return words.length > 0 ? words : [
      "THE", "OF", "AND", "A", "IN", 
      "TO", "IS", "FOR", "WITH", "BY"
    ];
  } catch (error) {
    console.error('Gemini Generation Error:', error);
    return [
      "THE", "OF", "AND", "A", "IN", 
      "TO", "IS", "FOR", "WITH", "BY"
    ];
  }
}

export async function generateWordsFromTitles(context: Context | TriggerContext, titles: string[]): Promise<string[]> {
  const prompt = `
    From these Reddit post titles: ${titles.join(', ')}
    Select 10 words focusing on .
    - **Proper Nouns:** (e.g., names, places)
    - **Unique or evocative words.**

    STRICT RULES:
    - NO numbers
    - NO punctuation
    - NO list markers
    - Words must be UPPERCASE
      `;

  console.log('Generating words from titles:', {
    titleCount: titles.length,
    titles: titles
  });

  const generatedWords = await useGemini(context, prompt);

  // Additional filtering and validation
  const processedWords = (generatedWords as string[])
    .map((word: string) => word.trim().toUpperCase())
    // .filter(word => 
    //   word.length >= 4 && 
    //   word.length <= 10 && 
    //   /^[A-Z]+$/.test(word)
    // )
    // .slice(0, 10);

  console.log('Processed words:', {
    originalCount: generatedWords.length,
    processedCount: processedWords.length,
    words: processedWords
  });

  // Fallback mechanism
  if (processedWords.length < 10) {
    const fallbackWords = [
      'DREAM', 'HOPE', 'QUEST', 'SPARK', 'BRAVE', 
      'MAGIC', 'JOURNEY', 'WONDER', 'RISE', 'CHANGE'
    ];
    return [...processedWords, ...fallbackWords].slice(0, 10);
  }

  return processedWords;
}

export async function generateConnectorWords(context: TriggerContext | Context, lastWord: string): Promise<string[]> {
  // const prompt = `
  //   Given the last word "${lastWord}", generate 1-3 diverse connector words.
  //   Focus on creating natural, grammatically interesting transitions.
    
  //   CONNECTOR TYPES TO CONSIDER:
  //   - Helping verbs that add nuance
  //   - Prepositions that create spatial or temporal context
  //   - Conjunctions that suggest causality or contrast
  //   - Articles that refine the narrative focus
    
  //   STRICT RULES:
  //   - NO numbers
  //   - NO punctuation
  //   - NO list markers
  //   - Words must be UPPERCASE
  //   - Prioritize variety and narrative flow
  //   - Avoid repetitive or generic connectors
  //   - Aim to add depth to the story's progression
  // `;

  const prompt = `lets play a game where both of us try to form a sentence by taking turns and adding words to the story, currently its your turn, give me a word or two to continue the sentence ${lastWord} 
  
  STRICT RULES:
    - Dont repeat the ${lastWord} in your response
    - Just give me the words to add to ${lastWord}
    - Words must be UPPERCASE
    `
  const connectorWords = await useGemini(context, prompt);
  console.log(connectorWords);  
  // Predefined list of valid connectors
  const validConnectors = [
    // Helping Verbs
    'IS', 'ARE', 'WAS', 'WERE', 'CAN', 'COULD', 'WILL', 'WOULD', 
    'SHALL', 'SHOULD', 'MAY', 'MIGHT', 'MUST', 'HAVE', 'HAS', 'HAD',
    
    // Articles
    'THE', 'A', 'AN', 

    // Prepositions
    'OF', 'WITH', 'IN', 'ON', 'AT', 'TO', 'FOR', 'BY', 'FROM', 
    'UNDER', 'OVER', 'THROUGH', 'ACROSS', 'BETWEEN', 'AMONG',
    
    // Conjunctions
    'AND', 'BUT', 'OR', 'YET', 'SO', 'BECAUSE', 'WHILE', 'SINCE'
  ];

  // Filter and validate connector words
  const processedConnectors = connectorWords.filter((word: string) => 
    validConnectors.includes(word)
  );

  // If no valid connectors found, return a minimal set
  // return processedConnectors.length > 0 
  //   ? processedConnectors.slice(0, 3)
  //   : ['THE', 'OF', 'AND'].slice(0, 3);

  return connectorWords;
}

export async function CompleteTheStory(context: TriggerContext | Context, lastWord: string): Promise<string[]> {
  // const prompt = `
  //   Given the last word "${lastWord}", generate 1-3 diverse connector words.
  //   Focus on creating natural, grammatically interesting transitions.
    
  //   CONNECTOR TYPES TO CONSIDER:
  //   - Helping verbs that add nuance
  //   - Prepositions that create spatial or temporal context
  //   - Conjunctions that suggest causality or contrast
  //   - Articles that refine the narrative focus
    
  //   STRICT RULES:
  //   - NO numbers
  //   - NO punctuation
  //   - NO list markers
  //   - Words must be UPPERCASE
  //   - Prioritize variety and narrative flow
  //   - Avoid repetitive or generic connectors
  //   - Aim to add depth to the story's progression
  // `;

  const prompt = `lets play a game where both of us try to form a sentence by taking turns and adding words to the story, currently its your turn and its final turn so give me a few words to complete the sentence ${lastWord} 
  
  STRICT RULES:
    - Dont repeat the ${lastWord} in your response
    - Just give me the words to add to ${lastWord} to complete the sentence
    - Words must be UPPERCASE
    `
  const connectorWords = await useGemini(context, prompt);
  console.log(connectorWords);  
  // Predefined list of valid connectors
  const validConnectors = [
    // Helping Verbs
    'IS', 'ARE', 'WAS', 'WERE', 'CAN', 'COULD', 'WILL', 'WOULD', 
    'SHALL', 'SHOULD', 'MAY', 'MIGHT', 'MUST', 'HAVE', 'HAS', 'HAD',
    
    // Articles
    'THE', 'A', 'AN', 

    // Prepositions
    'OF', 'WITH', 'IN', 'ON', 'AT', 'TO', 'FOR', 'BY', 'FROM', 
    'UNDER', 'OVER', 'THROUGH', 'ACROSS', 'BETWEEN', 'AMONG',
    
    // Conjunctions
    'AND', 'BUT', 'OR', 'YET', 'SO', 'BECAUSE', 'WHILE', 'SINCE'
  ];

  // Filter and validate connector words
  const processedConnectors = connectorWords.filter((word: string) => 
    validConnectors.includes(word)
  );

  // If no valid connectors found, return a minimal set
  // return processedConnectors.length > 0 
  //   ? processedConnectors.slice(0, 3)
  //   : ['THE', 'OF', 'AND'].slice(0, 3);

  return connectorWords;
}

export async function generateFollowUpWords(context: TriggerContext | Context, currentStory: string): Promise<string[]> {
  // const prompt = `
  //   Given the current story context: "${currentStory}",
  //   generate 10 unique, engaging words to continue the narrative.
    
  //   STRICT RULES:
  //   - NO numbers
  //   - NO punctuation
  //   - NO list markers
  //   - Words must be UPPERCASE
  //   - Include diverse word types: nouns, verbs, adjectives
  //   - Consider story context and potential narrative directions
  // `;

  const prompt = `lets play a game where both of us try to form a sentence by taking turns and adding words to the story, currently its my turn, give me a exactly 10 word to choose from to continue the sentence, make sure to give me words with each one leading to potentially different scenarios  ${currentStory}
    STRICT RULES:
    - NO numbers
    - NO punctuation
    - NO list markers
    - Words must be UPPERCASE
  `
  const followUpWords = await useGemini(context, prompt);
  
  const usedWords = currentStory.toUpperCase().split(' ');
  // const uniqueFollowUpWords = followUpWords.filter((word: string) => 
  //   !usedWords.includes(word) && word.length >= 2
  // );
  const uniqueFollowUpWords = followUpWords.filter((word: string) => 
    word.length >= 1
  );

  
  const fallbackWords = [
    "ADVENTURE", "MYSTERY", "COURAGE", "DREAM", "JOURNEY", 
    "HOPE", "CHALLENGE", "DISCOVERY", "WISDOM", "DESTINY",
    "EPIC", "QUEST", "MAGIC", "HERO", "LEGEND"
  ];

  const combinedWords = [...new Set([...uniqueFollowUpWords, ...fallbackWords])]
    .filter(word => !usedWords.includes(word))
    .slice(0, 10);

  // return combinedWords.length > 0 
  //   ? uniqueFollowUpWords 
  //   : fallbackWords.slice(0, 10);

  return uniqueFollowUpWords;

}
