# Firmware

C++ source for the ESP32 wearable device. The firmware reads the onboard sensors,
runs the on-device ML classifier, drives the OLED display and haptic feedback, and
uploads telemetry to the dashboard's ingest endpoint.

## Telemetry contract

The device POSTs JSON to `POST /api/ingest` on the web app (see
[`app/api/ingest/route.ts`](../app/api/ingest/route.ts)). Every request must include the
shared secret in the `x-api-key` header.

```json
{
  "deviceId":  "HS-001",
  "heartRate": 92.0,
  "skinTemp":  36.4,
  "riskLevel": 0,
  "tc":        0
}
```

| Field | Meaning |
|-------|---------|
| `deviceId` | Serial printed on the device; must match a registered `Worker.deviceId` |
| `heartRate` | BPM from the pulse sensor |
| `skinTemp` | Skin temperature in °C |
| `riskLevel` | On-device classifier output: `0` safe, `1` critical |
| `tc` | Thermal-discomfort button: `0` none, `5` low, `11` medium, `17` high |

## Notes for contributors

- Keep secrets (Wi-Fi credentials, `IOT_SECRET`, server URL) out of git - use a local,
  git-ignored config header.
- Document the toolchain (Arduino IDE / PlatformIO), board target, and wiring/pinout here
  as the code lands.
