/* eslint-disable @typescript-eslint/naming-convention */
import * as MQTT from 'async-mqtt'
import { Sensor } from '../model/sensor'
import { DeviceConfig, Config } from '../model/config'
import { MotionSensor } from '../model/motion.sensor'
import { IClientPublishOptions } from 'async-mqtt'
import { WeatherSensor } from '../model/weather.sensor'
import { logger } from '@strg/logging-winston'

const deviceNames: {[key: string]: string} = {
  'motion': 'MiJia human body movement sensor (RTCGQ01LM)',
  'sensor_motion.aq2': 'Aqara human body movement and illuminance sensor (RTCGQ11LM)',
  'sensor_ht': 'MiJia temperature & humidity sensor (WSDCGQ01LM)',
  'weather.v1': 'Aqara temperature, humidity and pressure sensor (WSDCGQ11LM)',
  'magnet': 'MiJia door & window contact sensor (MCCGQ01LM)',
  'sensor_magnet.aq2': 'Aqara door & window contact sensor (MCCGQ11LM)',
}

export class BridgeMqttHomeAssistant {

  private propagated: string[] = []

  constructor(private client: MQTT.AsyncMqttClient, private config: Config) { }

  private hasBeenPropagated(sensor: Sensor): boolean {
    return !this.config.homeassistant || this.propagated.indexOf(sensor.sid) >= 0
  }

  public async propagateSensor(sensor: Sensor, sensorConfig: DeviceConfig, topic: string): Promise<void> {
    if (this.hasBeenPropagated(sensor)) {
      return
    }
    this.propagated.push(sensor.sid)
    if (sensor.model === 'motion' || sensor.model === 'sensor_motion.aq2')
      return this.propagateMotionSensor(sensor, sensorConfig, topic)
    if (sensor.model === 'sensor_ht' || sensor.model === 'weather.v1')
      return this.propagateWeatherSensor(sensor, sensorConfig, topic)
    if (sensor.model === 'magnet' || sensor.model === 'sensor_magnet.aq2')
      return this.propagateMagnetSensor(sensor, sensorConfig, topic)
    logger.warn(`DAO: BridgeMqttHomeAssistant => ${sensor.model} not implemented, please create an issue or pull request on Github`)
  }

  public async propagateMotionSensor(sensor: MotionSensor, sensorConfig: DeviceConfig, topic: string): Promise<void> {
    const payload: {[key: string]: string | boolean} = {
      payload_on: true,
      payload_off: false,
      value_template: '{{ value_json.occupancy }}',
      device_class: 'motion',
      unique_id: `${sensor.sid}_occupancy_${this.config.app.name}`,
      name: `${sensorConfig.friendlyName}_occupancy`,
    }
    await this.client.publish(
      `homeassistant/binary_sensor/${sensor.sid}/occupancy/config`,
      JSON.stringify({ ...this.getBasePayload(sensor, sensorConfig, topic), ...payload }),
      this.getPublishOptions(sensorConfig))
    await this.propagateBatterySensor(sensor, sensorConfig, topic)
    await this.propagateVoltageSensor(sensor, sensorConfig, topic)
  }

  public async propagateWeatherSensor(sensor: WeatherSensor, sensorConfig: DeviceConfig, topic: string): Promise<void> {
    await this.propagateTemperatureSensor(sensor, sensorConfig, topic)
    await this.propagateHumiditySensor(sensor, sensorConfig, topic)
    if (sensor.model === 'weather.v1') {
      await this.propagatePressureSensor(sensor, sensorConfig, topic)
    }
    await this.propagateBatterySensor(sensor, sensorConfig, topic)
    await this.propagateVoltageSensor(sensor, sensorConfig, topic)
  }

  public async propagateMagnetSensor(sensor: Sensor, sensorConfig: DeviceConfig, topic: string): Promise<void> {
    const payload: {[key: string]: string | boolean} = {
      payload_on: false,
      payload_off: true,
      value_template: '{{ value_json.contact }}',
      device_class: 'door',
      unique_id: `${sensor.sid}_contact_${this.config.app.name}`,
      name: `${sensorConfig.friendlyName}_contact`,
    }
    await this.client.publish(
      `homeassistant/binary_sensor/${sensor.sid}/contact/config`,
      JSON.stringify({ ...this.getBasePayload(sensor, sensorConfig, topic), ...payload }),
      this.getPublishOptions(sensorConfig))
    await this.propagateBatterySensor(sensor, sensorConfig, topic)
    await this.propagateVoltageSensor(sensor, sensorConfig, topic)
  }

  private async propagateBatterySensor(sensor: Sensor, sensorConfig: DeviceConfig, topic: string): Promise<void> {
    const payload: {[key: string]: string | boolean} = {
      unit_of_measurement: '%',
      device_class: 'battery',
      value_template: '{{ value_json.battery }}',
      unique_id: `${sensor.sid}_battery_${this.config.app.name}`,
      name: `${sensorConfig.friendlyName}_battery`,
    }
    await this.client.publish(
      `homeassistant/sensor/${sensor.sid}/battery/config`,
      JSON.stringify({ ...this.getBasePayload(sensor, sensorConfig, topic), ...payload }),
      this.getPublishOptions(sensorConfig))
  }

  private async propagateVoltageSensor(sensor: Sensor, sensorConfig: DeviceConfig, topic: string): Promise<void> {
    const payload: {[key: string]: string | boolean} = {
      unit_of_measurement: 'mV',
      icon: 'mdi:battery-charging',
      value_template: '{{ value_json.voltage }}',
      unique_id: `${sensor.sid}_voltage_${this.config.app.name}`,
      name: `${sensorConfig.friendlyName}_voltage`,
    }
    await this.client.publish(
      `homeassistant/sensor/${sensor.sid}/voltage/config`,
      JSON.stringify({ ...this.getBasePayload(sensor, sensorConfig, topic), ...payload }),
      this.getPublishOptions(sensorConfig))
  }

  private async propagateTemperatureSensor(sensor: Sensor, sensorConfig: DeviceConfig, topic: string): Promise<void> {
    const payload: {[key: string]: string | boolean} = {
      unit_of_measurement: '°C',
      device_class: 'temperature',
      value_template: '{{ value_json.temperature }}',
      unique_id: `${sensor.sid}_temperature_${this.config.app.name}`,
      name: `${sensorConfig.friendlyName}_temperature`,
    }
    await this.client.publish(
      `homeassistant/sensor/${sensor.sid}/temperature/config`,
      JSON.stringify({ ...this.getBasePayload(sensor, sensorConfig, topic), ...payload }),
      this.getPublishOptions(sensorConfig))
  }

  private async propagateHumiditySensor(sensor: Sensor, sensorConfig: DeviceConfig, topic: string): Promise<void> {
    const payload: {[key: string]: string | boolean} = {
      unit_of_measurement: '%',
      device_class: 'humidity',
      value_template: '{{ value_json.humidity }}',
      unique_id: `${sensor.sid}_humidity_${this.config.app.name}`,
      name: `${sensorConfig.friendlyName}_humidity`,
    }
    await this.client.publish(
      `homeassistant/sensor/${sensor.sid}/humidity/config`,
      JSON.stringify({ ...this.getBasePayload(sensor, sensorConfig, topic), ...payload }),
      this.getPublishOptions(sensorConfig))
  }

  private async propagatePressureSensor(sensor: Sensor, sensorConfig: DeviceConfig, topic: string): Promise<void> {
    const payload: {[key: string]: string | boolean} = {
      unit_of_measurement: 'hPa',
      device_class: 'pressure',
      value_template: '{{ value_json.pressure }}',
      unique_id: `${sensor.sid}_pressure_${this.config.app.name}`,
      name: `${sensorConfig.friendlyName}_pressure`,
    }
    await this.client.publish(
      `homeassistant/sensor/${sensor.sid}/pressure/config`,
      JSON.stringify({ ...this.getBasePayload(sensor, sensorConfig, topic), ...payload }),
      this.getPublishOptions(sensorConfig))
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  private getBasePayload(sensor: Sensor, sensorConfig: DeviceConfig, topic: string): object {
    return {
      state_topic: topic,
      json_attributes_topic: topic,
      device: {
        identifiers:[
          `${this.config.app.name}_${sensor.sid}`
        ],
        name: sensorConfig.friendlyName,
        sw_version: `${this.config.app.name} ${this.config.app.version}`,
        model: deviceNames[sensor.model] || 'unknown',
        manufacturer: 'Xiaomi',
      },
      availability_topic: `${this.config.mqtt.baseTopic}/bridge/state`,
    }
  }

  private getPublishOptions(sensorConfig: DeviceConfig): IClientPublishOptions {
    return {
      qos: sensorConfig.qos,
      retain: true,
    }
  }

}
