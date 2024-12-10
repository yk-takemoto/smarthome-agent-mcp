import { DeviceControlClient } from "../device_control_client";
import { SwitchBotTVControlClient } from "./switchbot_tv_control_client";
import { SwitchBotLightControlClient } from "./switchbot_light_control_client";

type DeviceControlClientConstructor = new (...args: any[]) => DeviceControlClient;
const functionClasses: Record<string, DeviceControlClientConstructor> = {
  SwitchBotTVControlClient,
  SwitchBotLightControlClient
};

const functionBuilder = (functionId: string, className: string): DeviceControlClient => {
  return new functionClasses[className](functionId);
};

export default functionBuilder;