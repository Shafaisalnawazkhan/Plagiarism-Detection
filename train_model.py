"""Fine-tune VeritasCheck's SentenceTransformer similarity bi-encoder."""
import argparse
import json
import random
from pathlib import Path

from sentence_transformers import InputExample, SentenceTransformer, evaluation, losses
from torch.utils.data import DataLoader


def load_samples(path):
    rows = json.loads(path.read_text(encoding="utf-8"))
    samples = []
    for index, row in enumerate(rows, 1):
        try:
            score = float(row["score"])
            left, right = str(row["sentence_a"]).strip(), str(row["sentence_b"]).strip()
        except (KeyError, TypeError, ValueError) as error:
            raise SystemExit(f"Invalid dataset row {index}: {error}") from error
        if not 0 <= score <= 1 or not left or not right:
            raise SystemExit(f"Invalid dataset row {index}: text is required and score must be 0.0–1.0.")
        samples.append(InputExample(texts=[left, right], label=score))
    if len(samples) < 10:
        raise SystemExit("At least 10 sentence pairs are required; hundreds are recommended for meaningful training.")
    return samples


def main():
    parser = argparse.ArgumentParser(description="Train VeritasCheck academic similarity model")
    parser.add_argument("--dataset", type=Path, default=Path("data/training_dataset.json"))
    parser.add_argument("--base-model", default="sentence-transformers/all-MiniLM-L6-v2")
    parser.add_argument("--output", type=Path, default=Path("veritas_trained_model"))
    parser.add_argument("--epochs", type=int, default=4)
    parser.add_argument("--batch-size", type=int, default=8)
    args = parser.parse_args()
    if not args.dataset.is_file():
        raise SystemExit(f"Dataset not found: {args.dataset}")
    samples = load_samples(args.dataset)
    random.Random(42).shuffle(samples)
    split = max(1, int(len(samples) * 0.8))
    train_samples, validation_samples = samples[:split], samples[split:]
    if not validation_samples:
        raise SystemExit("Dataset is too small to create a validation split.")
    model = SentenceTransformer(args.base_model)
    loader = DataLoader(train_samples, shuffle=True, batch_size=min(args.batch_size, len(train_samples)))
    evaluator = evaluation.EmbeddingSimilarityEvaluator(
        sentences1=[sample.texts[0] for sample in validation_samples],
        sentences2=[sample.texts[1] for sample in validation_samples],
        scores=[sample.label for sample in validation_samples], name="plagiarism-validation")
    model.fit(train_objectives=[(loader, losses.CosineSimilarityLoss(model=model))], evaluator=evaluator,
              epochs=args.epochs, warmup_steps=max(1, len(loader) // 10), output_path=str(args.output),
              show_progress_bar=True)
    metadata = {"base_model": args.base_model, "training_pairs": len(train_samples),
                "validation_pairs": len(validation_samples), "epochs": args.epochs,
                "warning": "The bundled demonstration dataset is too small for production accuracy."}
    (args.output / "veritas_training_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    left = "Neural networks learn representations through backpropagation of errors."
    right = "Through error backpropagation, neural networks acquire learned representations."
    embeddings = model.encode([left, right], convert_to_tensor=True)
    from sentence_transformers import util
    print(f"Model saved to: {args.output}")
    print(f"Inference test: {util.cos_sim(embeddings[0], embeddings[1]).item() * 100:.2f}%")


if __name__ == "__main__":
    main()
