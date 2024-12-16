import { DeviceControlFunction } from "./device_control_function.js";
import { SwitchBotTVControlFunction } from "./switchbot_tv_control_function.js";
import { SwitchBotLightControlFunction } from "./switchbot_light_control_function.js";

type DeviceControlFunctionConstructor = new (...args: any[]) => DeviceControlFunction;
const functionClasses: Record<string, DeviceControlFunctionConstructor> = {
  SwitchBotTVControlFunction,
  SwitchBotLightControlFunction
};

const functionBuilder = (functionId: string, className: string): DeviceControlFunction => {
  return new functionClasses[className](functionId);
};

export default functionBuilder;