import { TranslateAdapter } from "./translate_adapter";
import { DeeplAdapter } from "./deepl_adapter";

type TranslateAdapterConstructor = new (...args: any[]) => TranslateAdapter;
const translateAdapterClasses: Record<string, TranslateAdapterConstructor> = {
  DeepL: DeeplAdapter
};

const translateAdapterBuilder = (translateId: string): TranslateAdapter => {
  const translateAdapterClass = translateAdapterClasses[translateId];
  return new translateAdapterClass();
}

export default translateAdapterBuilder;