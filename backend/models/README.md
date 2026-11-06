Place both generated training artifacts here:
- `deepsight_detector.keras`
- `deepsight_model_config.json`

The app expects RGB float images shaped `(1, 224, 224, 3)` in `[0,255]`, a single sigmoid output representing `P(REAL)`, and the custom CNN's pixel-scaling layer embedded in the model. The backend must not divide input pixels by 255 a second time. The JSON file supplies the validation-selected decision threshold and model name.
