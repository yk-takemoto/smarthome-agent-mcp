export interface DeviceControlClient {
  controlDevice(commandType: string, command: string | number): Promise<Record<string, string>>;
}