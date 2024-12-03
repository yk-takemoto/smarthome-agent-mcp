export interface TranslateAdapter {
  translateText(sourceText: string, targetLang: string, sourceLang?: string, delimiter?: string): Promise<string>;
}