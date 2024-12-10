import { AccountAdapter } from "./account_adapter";
import { YamlAdapter } from "./yaml_adapter";

type AccountAdapterConstructor = new (...args: any[]) => AccountAdapter;
const accountAdapterClasses: Record<string, AccountAdapterConstructor> = {
  yaml: YamlAdapter
};

const accountAdapterBuilder = (resourceId?: string): AccountAdapter => {
  const accountAdapterClass = accountAdapterClasses[resourceId || "yaml"];
  return new accountAdapterClass();
}
  
export default accountAdapterBuilder;