export interface GeneratedContent {
  reelsScript: string;
  cardNews: string;
  blogPost: string;
}

export interface LLMProvider {
  generateContent(prompt: string): Promise<string>;
}
