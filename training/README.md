# DeepSight training and evaluation

Open `train_deepsight.ipynb` in Google Colab or Jupyter.

## Dataset
Create `dataset/metadata.csv` with columns `filepath,label,group_id`. See `metadata_example.csv`.
- `filepath`: path relative to `dataset/` or absolute path
- `label`: `REAL` or `FAKE`
- `group_id`: source/video/person/generator batch identifier

## Run
Run every notebook cell in order. The notebook:
- checks image paths and corrupt files
- detects exact duplicate images
- creates group-disjoint train, validation and test splits
- preprocesses images and applies training augmentation
- trains a custom CNN from random initialization (no pretrained weights)
- selects a classification threshold using validation data
- evaluates the independent test split
- reports accuracy, precision, recall, F1, ROC-AUC and confusion matrix
- evaluates a JPEG-compressed test set
- saves `deepsight_detector.keras`, `deepsight_model_config.json`, `split_manifest.csv`, and `training_log.csv`

Copy both `deepsight_detector.keras` and `deepsight_model_config.json` to `backend/models/`. The API reads the validation-selected decision threshold from the JSON config.

## Important
Actual metric values are produced only after running training and evaluation on your real dataset. No scores are pre-filled or fabricated.
