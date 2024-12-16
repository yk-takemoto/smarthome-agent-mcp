export interface DeviceControlFunction {
  controlDevice(args: Record<string, any>): Promise<Record<string, string>>;
}