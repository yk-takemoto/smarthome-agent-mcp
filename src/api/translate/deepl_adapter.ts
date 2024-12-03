import * as deepl from "deepl-node";
import { TranslateAdapter } from "./translate_adapter";

export class DeeplAdapter implements TranslateAdapter {

  private translator;

  constructor(
    private translateConfig = {
      apiKey: JSON.parse(process.env.APP_SECRETS || "{}").DEEPL_API_KEY || process.env.DEEPL_API_KEY || "",
    }
  ) {
    this.initCheck(translateConfig);
    this.translator = new deepl.Translator(translateConfig.apiKey);
  };

  private initCheck(translateConfig: Record<string, string>) {
    for (const key of Object.keys(this.translateConfig)) {
      if (!translateConfig[key]) {
        throw new Error(`translateConfig.${key} is required but not set.`);
      }
    }
  }

  async translateText(sourceText: string, targetLang: string, sourceLang?: string, delimiter?: string): Promise<string> {
    const transRes = await this.translator.translateText(
      sourceText,
      sourceLang ? sourceLang as deepl.SourceLanguageCode : null,
      targetLang as deepl.TargetLanguageCode
    );

    let resultText: string = "";
    if (Array.isArray(transRes)) {
      const resTextDelimiter = delimiter || " ";
      resultText = transRes.map(el => el.text).join(resTextDelimiter);
    } else {
        resultText = transRes.text;
    }
    return resultText;
  }
}