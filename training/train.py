#!/usr/bin/env python3
"""Train a small 28x28 sketch classifier on Google QuickDraw bitmaps.

Only depends on numpy. Downloads a slice of each category with HTTP Range
requests, trains a two-hidden-layer MLP with light augmentation, and exports
int8 weights plus metadata for the browser.

Usage:
  uv run --with numpy python training/train.py
  uv run --with numpy python training/train.py --samples 800 --epochs 15
"""

from __future__ import annotations

import argparse
import ast
import json
import math
import os
import struct
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Small matrices + hybrid CPUs: too many BLAS threads is much slower.
os.environ.setdefault("OPENBLAS_NUM_THREADS", "4")

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CATEGORIES_PATH = ROOT / "src" / "data" / "categories.json"
CACHE_DIR = ROOT / ".cache" / "quickdraw"
OUT_DIR = ROOT / "public" / "model"
BASE_URL = "https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap"
IMAGE_SIZE = 28
FLAT_SIZE = IMAGE_SIZE * IMAGE_SIZE


def load_categories() -> list[dict]:
    with open(CATEGORIES_PATH, encoding="utf-8") as handle:
        categories = json.load(handle)
    if len(categories) != len({item["id"] for item in categories}):
        raise SystemExit("duplicate category ids in categories.json")
    return categories


def cache_name(category_id: str) -> str:
    return category_id.replace(" ", "_") + ".npy"


def http_range(url: str, start: int, end: int, attempts: int = 4) -> bytes:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(
                url,
                headers={
                    "Range": f"bytes={start}-{end}",
                    "User-Agent": "doodle-guess-trainer/1.0",
                },
            )
            with urllib.request.urlopen(request, timeout=90) as response:
                return response.read()
        except Exception as error:  # noqa: BLE001 - network retries
            last_error = error
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"failed to fetch {url} [{start}-{end}]: {last_error}")


def parse_npy_header(buffer: bytes) -> tuple[tuple[int, ...], int]:
    if buffer[:6] != b"\x93NUMPY":
        raise ValueError("not a npy file")
    major = buffer[6]
    if major == 1:
        header_length = struct.unpack("<H", buffer[8:10])[0]
        offset = 10
    else:
        header_length = struct.unpack("<I", buffer[8:12])[0]
        offset = 12
    header = ast.literal_eval(buffer[offset : offset + header_length].decode("latin1"))
    return tuple(header["shape"]), offset + header_length


def download_category(category: dict, samples: int, refresh: bool) -> np.ndarray:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = CACHE_DIR / cache_name(category["id"])
    if target.exists() and not refresh:
        cached = np.load(target)
        if len(cached) >= samples:
            return cached

    url = f"{BASE_URL}/{urllib.parse.quote(category['id'])}.npy"
    head = http_range(url, 0, 2047)
    shape, data_start = parse_npy_header(head)
    total_rows = shape[0]
    wanted = min(samples, total_rows)

    first = wanted // 2
    second = wanted - first
    requests = [
        (0, first),
        (max(0, total_rows // 2), second),
    ]

    chunks: list[np.ndarray] = []
    for row_start, row_count in requests:
        if row_count <= 0:
            continue
        byte_start = data_start + row_start * FLAT_SIZE
        byte_end = byte_start + row_count * FLAT_SIZE - 1
        raw = http_range(url, byte_start, byte_end)
        usable = min(row_count, len(raw) // FLAT_SIZE)
        if usable == 0:
            continue
        chunks.append(
            np.frombuffer(raw[: usable * FLAT_SIZE], dtype=np.uint8).reshape(
                usable, FLAT_SIZE
            )
        )

    data = np.concatenate(chunks, axis=0)[:samples]
    np.save(target, data)
    return data


def load_dataset(categories: list[dict], samples: int, workers: int, refresh: bool):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    results: dict[int, np.ndarray] = {}
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(download_category, category, samples, refresh): index
            for index, category in enumerate(categories)
        }
        finished = 0
        for future in as_completed(futures):
            index = futures[future]
            results[index] = future.result()
            finished += 1
            if finished % 10 == 0 or finished == len(categories):
                print(
                    f"  downloaded {finished}/{len(categories)} categories "
                    f"({time.time() - t0:.1f}s)",
                    flush=True,
                )

    feature_blocks: list[np.ndarray] = []
    label_blocks: list[np.ndarray] = []
    for index, category in enumerate(categories):
        data = results[index]
        ink = (data > 18).sum(axis=1)
        data = data[ink > 24]
        if len(data) == 0:
            raise SystemExit(f"no usable samples for {category['id']}")
        feature_blocks.append(data)
        label_blocks.append(np.full(len(data), index, dtype=np.int64))
        print(f"  {category['zh']:<6} {category['id']:<16} {len(data):>5} samples")
    return np.concatenate(feature_blocks), np.concatenate(label_blocks)


def stratified_split(
    y: np.ndarray, val_ratio: float, rng: np.random.Generator
) -> tuple[np.ndarray, np.ndarray]:
    train_parts: list[np.ndarray] = []
    val_parts: list[np.ndarray] = []
    for label in range(int(y.max()) + 1):
        indices = np.flatnonzero(y == label)
        rng.shuffle(indices)
        val_count = max(20, int(len(indices) * val_ratio))
        val_parts.append(indices[:val_count])
        train_parts.append(indices[val_count:])
    return np.concatenate(train_parts), np.concatenate(val_parts)


def augment_batch(batch: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Random rotate / scale / translate in one bilinear resample."""
    count = batch.shape[0]
    images = batch.reshape(count, IMAGE_SIZE, IMAGE_SIZE).astype(np.float64) / 255.0

    theta = rng.uniform(-0.20, 0.20, count).astype(np.float64)
    scale = rng.uniform(0.88, 1.12, count).astype(np.float64)
    shift_x = rng.uniform(-2.0, 2.0, count).astype(np.float64)
    shift_y = rng.uniform(-2.0, 2.0, count).astype(np.float64)

    grid_y, grid_x = np.meshgrid(
        np.arange(IMAGE_SIZE, dtype=np.float64) - 13.5,
        np.arange(IMAGE_SIZE, dtype=np.float64) - 13.5,
        indexing="ij",
    )
    cos = np.cos(theta)[:, None, None]
    sin = np.sin(theta)[:, None, None]
    safe_scale = scale[:, None, None]

    source_x = (cos * grid_x + sin * grid_y) / safe_scale + 13.5 - shift_x[:, None, None]
    source_y = (-sin * grid_x + cos * grid_y) / safe_scale + 13.5 - shift_y[:, None, None]

    x0 = np.floor(source_x).astype(np.int32)
    y0 = np.floor(source_y).astype(np.int32)
    x1 = x0 + 1
    y1 = y0 + 1
    fx = source_x - x0
    fy = source_y - y0

    valid = (x0 >= 0) & (y0 >= 0) & (x1 < IMAGE_SIZE) & (y1 < IMAGE_SIZE)
    x0c = np.clip(x0, 0, IMAGE_SIZE - 1)
    x1c = np.clip(x1, 0, IMAGE_SIZE - 1)
    y0c = np.clip(y0, 0, IMAGE_SIZE - 1)
    y1c = np.clip(y1, 0, IMAGE_SIZE - 1)
    rows = np.arange(count)[:, None, None]

    resampled = (
        images[rows, y0c, x0c] * (1 - fx) * (1 - fy)
        + images[rows, y0c, x1c] * fx * (1 - fy)
        + images[rows, y1c, x0c] * (1 - fx) * fy
        + images[rows, y1c, x1c] * fx * fy
    )
    resampled *= valid
    return resampled.reshape(count, FLAT_SIZE)


def he_init(rng: np.random.Generator, fan_in: int, fan_out: int):
    weight = rng.normal(0, math.sqrt(2.0 / fan_in), (fan_in, fan_out))
    bias = np.zeros(fan_out, dtype=np.float64)
    return weight, bias


def forward(
    x: np.ndarray,
    weights: list[np.ndarray],
    biases: list[np.ndarray],
    training: bool,
    rng: np.random.Generator | None = None,
    dropout: float = 0.1,
):
    z1 = x @ weights[0] + biases[0]
    h1 = np.maximum(z1, 0)
    mask1 = None
    if training:
        mask1 = (rng.random(h1.shape) > dropout).astype(np.float64) / (1 - dropout)
        h1 = h1 * mask1
    z2 = h1 @ weights[1] + biases[1]
    h2 = np.maximum(z2, 0)
    mask2 = None
    if training:
        mask2 = (rng.random(h2.shape) > dropout).astype(np.float64) / (1 - dropout)
        h2 = h2 * mask2
    logits = h2 @ weights[2] + biases[2]
    cache = (x, z1, h1, mask1, z2, h2, mask2, logits)
    return logits, cache


def backward(
    cache, weights: list[np.ndarray], labels: np.ndarray, label_smoothing: float
):
    x, z1, h1, mask1, z2, h2, mask2, logits = cache
    count = x.shape[0]
    classes = logits.shape[1]

    shifted = logits - logits.max(axis=1, keepdims=True)
    exp = np.exp(shifted)
    probabilities = exp / exp.sum(axis=1, keepdims=True)

    target = np.full((count, classes), label_smoothing / classes, dtype=np.float64)
    target[np.arange(count), labels] += 1.0 - label_smoothing
    dlogits = (probabilities - target) / count

    grad_w3 = h2.T @ dlogits
    grad_b3 = dlogits.sum(axis=0)

    dh2 = dlogits @ weights[2].T
    if mask2 is not None:
        dh2 *= mask2
    dz2 = dh2 * (z2 > 0)
    grad_w2 = h1.T @ dz2
    grad_b2 = dz2.sum(axis=0)

    dh1 = dz2 @ weights[1].T
    if mask1 is not None:
        dh1 *= mask1
    dz1 = dh1 * (z1 > 0)
    grad_w1 = x.T @ dz1
    grad_b1 = dz1.sum(axis=0)

    return [grad_w1, grad_w2, grad_w3], [grad_b1, grad_b2, grad_b3]


def evaluate(
    x: np.ndarray,
    y: np.ndarray,
    weights: list[np.ndarray],
    biases: list[np.ndarray],
    batch_size: int = 2048,
) -> tuple[float, float, float]:
    correct1 = 0
    correct5 = 0
    total_loss = 0.0
    for start in range(0, len(x), batch_size):
        batch = x[start : start + batch_size].astype(np.float64) / 255.0
        labels = y[start : start + batch_size]
        logits, _ = forward(batch, weights, biases, training=False)
        shifted = logits - logits.max(axis=1, keepdims=True)
        exp = np.exp(shifted)
        probabilities = exp / exp.sum(axis=1, keepdims=True)
        total_loss -= np.log(np.maximum(probabilities[np.arange(len(labels)), labels], 1e-9)).sum()
        top5 = np.argpartition(logits, -5, axis=1)[:, -5:]
        correct1 += int((np.argmax(logits, axis=1) == labels).sum())
        correct5 += int((top5 == labels[:, None]).any(axis=1).sum())
    return correct1 / len(x), correct5 / len(x), total_loss / len(x)


def quantize(weight: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    scale = np.max(np.abs(weight), axis=0) / 127.0
    scale = np.where(scale == 0, 1e-8, scale).astype(np.float32)
    quantized = np.clip(np.rint(weight / scale), -127, 127).astype(np.int8)
    return quantized, scale


def export_model(
    weights: list[np.ndarray],
    biases: list[np.ndarray],
    labels: list[str],
    metrics: dict,
) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = bytearray()
    layers: list[dict] = []

    for index, (weight, bias) in enumerate(zip(weights, biases)):
        quantized, scale = quantize(weight)
        transposed = np.ascontiguousarray(quantized.T)  # (out, in), dot friendly
        q_offset = len(payload)
        payload.extend(transposed.tobytes())
        while len(payload) % 4:
            payload.append(0)

        bias_offset = len(payload)
        payload.extend(bias.astype("<f4").tobytes())

        scale_offset = len(payload)
        payload.extend(scale.astype("<f4").tobytes())

        layers.append(
            {
                "in": int(weight.shape[0]),
                "out": int(weight.shape[1]),
                "activation": "relu" if index < len(weights) - 1 else "linear",
                "qOffset": q_offset,
                "qLength": int(transposed.size),
                "biasOffset": bias_offset,
                "scaleOffset": scale_offset,
            }
        )

    (OUT_DIR / "weights.bin").write_bytes(bytes(payload))

    meta = {
        "version": 1,
        "input": FLAT_SIZE,
        "imageSize": IMAGE_SIZE,
        "labels": labels,
        "layers": layers,
        "metrics": metrics,
        "trainedAt": time.strftime("%Y-%m-%d"),
    }
    (OUT_DIR / "model.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"exported {len(payload) / 1024:.1f} KB -> {OUT_DIR}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=1200, help="samples per class")
    parser.add_argument("--epochs", type=int, default=22)
    parser.add_argument("--batch-size", type=int, default=512)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--dropout", type=float, default=0.1)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--quick", action="store_true", help="smoke test run")
    args = parser.parse_args()

    if args.quick:
        args.samples = min(args.samples, 200)
        args.epochs = min(args.epochs, 4)

    categories = load_categories()
    labels = [item["id"] for item in categories]
    print(f"loading {len(categories)} categories x {args.samples} samples")
    features, targets = load_dataset(
        categories, args.samples, args.workers, args.refresh
    )
    print(f"dataset: {features.shape[0]} images, {features.shape[1]} px")

    rng = np.random.default_rng(20261022)
    train_idx, val_idx = stratified_split(targets, 0.1, rng)
    x_train, y_train = features[train_idx], targets[train_idx]
    x_val, y_val = features[val_idx], targets[val_idx]
    print(f"train {len(x_train)} / val {len(x_val)}")

    classes = len(categories)
    weights = [
        he_init(rng, FLAT_SIZE, 512),
        he_init(rng, 512, 256),
        he_init(rng, 256, classes),
    ]
    weights = [item[0] for item in weights]
    biases = [np.zeros(512, np.float64), np.zeros(256, np.float64), np.zeros(classes, np.float64)]

    moments_w = [np.zeros_like(weight) for weight in weights]
    moments_b = [np.zeros_like(bias) for bias in biases]
    velocity_w = [np.zeros_like(weight) for weight in weights]
    velocity_b = [np.zeros_like(bias) for bias in biases]

    beta1, beta2, epsilon = 0.9, 0.999, 1e-8
    step = 0
    best_top1 = 0.0
    best_top5 = 0.0
    best_weights = [weight.copy() for weight in weights]
    best_biases = [bias.copy() for bias in biases]
    history: list[dict] = []
    started = time.time()

    for epoch in range(1, args.epochs + 1):
        permutation = rng.permutation(len(x_train))
        epoch_loss = 0.0
        batches = 0
        for start in range(0, len(permutation), args.batch_size):
            batch_indices = permutation[start : start + args.batch_size]
            if len(batch_indices) < 16:
                continue
            batch_x = augment_batch(x_train[batch_indices], rng)
            batch_y = y_train[batch_indices]
            logits, cache = forward(
                batch_x, weights, biases, training=True, rng=rng, dropout=args.dropout
            )
            shifted = logits - logits.max(axis=1, keepdims=True)
            exp = np.exp(shifted)
            probabilities = exp / exp.sum(axis=1, keepdims=True)
            epoch_loss -= np.log(
                np.maximum(probabilities[np.arange(len(batch_y)), batch_y], 1e-9)
            ).mean()
            batches += 1

            grad_w, grad_b = backward(cache, weights, batch_y, 0.05)
            step += 1
            lr = args.lr * 0.5 * (1 + math.cos(math.pi * step / (args.epochs * math.ceil(len(x_train) / args.batch_size))))
            for index in range(3):
                moments_w[index] = beta1 * moments_w[index] + (1 - beta1) * grad_w[index]
                moments_b[index] = beta1 * moments_b[index] + (1 - beta1) * grad_b[index]
                velocity_w[index] = beta2 * velocity_w[index] + (1 - beta2) * grad_w[index] ** 2
                velocity_b[index] = beta2 * velocity_b[index] + (1 - beta2) * grad_b[index] ** 2
                correction1 = 1 - beta1**step
                correction2 = 1 - beta2**step
                weights[index] -= lr * (moments_w[index] / correction1) / (
                    np.sqrt(velocity_w[index] / correction2) + epsilon
                )
                biases[index] -= lr * (moments_b[index] / correction1) / (
                    np.sqrt(velocity_b[index] / correction2) + epsilon
                )

        top1, top5, val_loss = evaluate(x_val, y_val, weights, biases)
        history.append(
            {
                "epoch": epoch,
                "trainLoss": round(epoch_loss / max(batches, 1), 4),
                "valLoss": round(float(val_loss), 4),
                "top1": round(top1, 4),
                "top5": round(top5, 4),
            }
        )
        print(
            f"epoch {epoch:02d}/{args.epochs}  train {epoch_loss / max(batches, 1):.3f}  "
            f"val {val_loss:.3f}  top1 {top1:.2%}  top5 {top5:.2%}  "
            f"({time.time() - started:.0f}s)",
            flush=True,
        )
        if top1 > best_top1:
            best_top1 = top1
            best_top5 = top5
            best_weights = [weight.copy() for weight in weights]
            best_biases = [bias.copy() for bias in biases]

    metrics = {
        "top1": round(best_top1, 4),
        "top5": round(best_top5, 4),
        "classes": classes,
        "trainSamples": int(len(x_train)),
        "valSamples": int(len(x_val)),
        "epochs": args.epochs,
        "history": history,
    }
    (ROOT / "training" / "metrics.json").write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    export_model(best_weights, best_biases, labels, metrics)
    print(
        f"done in {time.time() - started:.0f}s  best top1 {best_top1:.2%}  "
        f"top5 {metrics['top5']:.2%}"
    )


if __name__ == "__main__":
    main()
