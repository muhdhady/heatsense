# Machine Learning

Training and artifacts for the on-device heat-stress risk classifier that runs on the
ESP32 wearable. The model takes physiological signals (heart rate, skin temperature, and
the worker's thermal-discomfort input) and outputs a binary risk level - `0` (safe) or
`1` (critical) - which is uploaded with each telemetry packet (see `riskLevel` in
[`prisma/schema.prisma`](../prisma/schema.prisma)).

## Layout

| Path | Contents |
|------|----------|
| `notebooks/` | Google Colab notebooks for data exploration, training, and evaluation |
| `artifacts/` | Trained model files, quantized/TFLite exports, label encoders, and metrics |

## Notes for contributors

- Keep large raw datasets out of git; commit a small sample plus a link to the full set.
- Export the final model in a form deployable to the ESP32 (e.g. TensorFlow Lite for
  Microcontrollers / a C header array) and place it under `artifacts/`.
- Document the input feature order and any scaling so the firmware matches it exactly.
