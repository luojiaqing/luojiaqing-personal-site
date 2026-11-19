"""
从零训练一个 2-8-8-1 的 MLP，并保存可视化所需的真实数据。
只依赖 NumPy：前向传播、反向传播、Adam 全部手写。

运行:
    python mlp_demo.py
输出:
    artifacts/model.npz   参数、数据、预测网格、学习率实验
    artifacts/metrics.json 关键指标
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "artifacts"
OUT.mkdir(exist_ok=True)

SEED = 42
N_PER_CLASS = 240
HIDDEN = 8
STEPS = 1200
LR = 0.01
NOISE = 0.14


def make_moons(n_per_class: int = 240, noise: float = NOISE, seed: int = SEED):
    """两个交错的半月，比 XOR 更接近真实分类任务。"""
    rng = np.random.default_rng(seed)
    theta = rng.uniform(0, np.pi, n_per_class)
    outer = np.c_[np.cos(theta), np.sin(theta)]
    inner = np.c_[1 - np.cos(theta), 0.5 - np.sin(theta)]
    X = np.vstack([outer, inner])
    y = np.r_[np.zeros(n_per_class), np.ones(n_per_class)]
    X += rng.normal(0, noise, X.shape)
    idx = rng.permutation(len(X))
    return X[idx], y[idx]


def init_params(seed: int = SEED):
    """Xavier 初始化：让信号在前向/反向传播时不过度放大或缩小。"""
    rng = np.random.default_rng(seed)
    return {
        "W1": rng.normal(0, np.sqrt(1.0 / 2), (HIDDEN, 2)),
        "b1": np.zeros(HIDDEN),
        "W2": rng.normal(0, np.sqrt(1.0 / HIDDEN), (HIDDEN, HIDDEN)),
        "b2": np.zeros(HIDDEN),
        "W3": rng.normal(0, np.sqrt(1.0 / HIDDEN), (1, HIDDEN)),
        "b3": np.zeros(1),
    }


def forward(params, X):
    z1 = X @ params["W1"].T + params["b1"]
    a1 = np.tanh(z1)
    z2 = a1 @ params["W2"].T + params["b2"]
    a2 = np.tanh(z2)
    z3 = a2 @ params["W3"].T + params["b3"]
    p = 1.0 / (1.0 + np.exp(-z3))
    cache = {"X": X, "z1": z1, "a1": a1, "z2": z2, "a2": a2, "p": p}
    return p, cache


def loss_and_grads(params, X, y, weight_decay: float = 1e-4):
    n = len(X)
    p, c = forward(params, X)
    eps = 1e-9
    p_flat = p.ravel()
    loss = -np.mean(y * np.log(p_flat + eps) + (1 - y) * np.log(1 - p_flat + eps))
    loss += 0.5 * weight_decay * sum(np.sum(params[k] ** 2) for k in ("W1", "W2", "W3"))

    # sigmoid + BCE 的一个漂亮结果：dz3 = p - y
    dz3 = (p.ravel() - y)[:, None] / n
    dW3 = dz3.T @ c["a2"] + weight_decay * params["W3"]
    db3 = dz3.sum(0)
    da2 = dz3 @ params["W3"]
    dz2 = da2 * (1 - c["a2"] ** 2)
    dW2 = dz2.T @ c["a1"] + weight_decay * params["W2"]
    db2 = dz2.sum(0)
    da1 = dz2 @ params["W2"]
    dz1 = da1 * (1 - c["a1"] ** 2)
    dW1 = dz1.T @ c["X"] + weight_decay * params["W1"]
    db1 = dz1.sum(0)
    return loss, {"W1": dW1, "b1": db1, "W2": dW2, "b2": db2, "W3": dW3, "b3": db3}, p


def accuracy(params, X, y):
    p, _ = forward(params, X)
    return float(np.mean((p.ravel() >= 0.5) == y))


def bce_loss(params, X, y):
    p, _ = forward(params, X)
    p = np.clip(p.ravel(), 1e-9, 1 - 1e-9)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def train_adam(seed: int = SEED, steps: int = STEPS, lr: float = LR):
    params = init_params(seed)
    m = {k: np.zeros_like(v) for k, v in params.items()}
    v = {k: np.zeros_like(v) for k, v in params.items()}
    beta1, beta2, eps = 0.9, 0.999, 1e-8

    X, y = make_moons()
    n_train = int(0.8 * len(X))
    Xtr, ytr = X[:n_train], y[:n_train]
    Xte, yte = X[n_train:], y[n_train:]

    history = []
    snapshots = {}
    snap_steps = {0, 20, 80, 300, steps}
    for step in range(steps + 1):
        _, grads, _ = loss_and_grads(params, Xtr, ytr)
        if step in snap_steps:
            snapshots[step] = {k: v.copy() for k, v in params.items()}
        if step % 10 == 0:
            history.append(
                {
                    "step": step,
                    "loss": bce_loss(params, Xtr, ytr),
                    "test_loss": bce_loss(params, Xte, yte),
                    "train_acc": accuracy(params, Xtr, ytr),
                    "test_acc": accuracy(params, Xte, yte),
                }
            )
        if step == steps:
            break
        for k in params:
            g = grads[k]
            m[k] = beta1 * m[k] + (1 - beta1) * g
            v[k] = beta2 * v[k] + (1 - beta2) * g * g
            m_hat = m[k] / (1 - beta1 ** (step + 1))
            v_hat = v[k] / (1 - beta2 ** (step + 1))
            params[k] -= lr * m_hat / (np.sqrt(v_hat) + eps)

    return params, snapshots, history, (Xtr, ytr, Xte, yte)


def train_sgd(lr: float, steps: int = 800, seed: int = 7):
    """同一网络、普通梯度下降；用于对比学习率。"""
    params = init_params(seed)
    X, y = make_moons()
    n_train = int(0.8 * len(X))
    Xtr, ytr = X[:n_train], y[:n_train]
    losses = []
    diverged_at = None
    for step in range(steps + 1):
        loss, grads, _ = loss_and_grads(params, Xtr, ytr)
        if not np.isfinite(loss):
            diverged_at = step
            break
        losses.append(bce_loss(params, Xtr, ytr))
        if step == steps:
            break
        for k in params:
            params[k] -= lr * grads[k]
        if loss > 50:
            diverged_at = step
            break
    return losses, diverged_at


def grid_probs(params, xlim=(-1.6, 2.6), ylim=(-1.5, 2.0), n=240):
    xs = np.linspace(*xlim, n)
    ys = np.linspace(*ylim, n)
    xx, yy = np.meshgrid(xs, ys)
    pts = np.c_[xx.ravel(), yy.ravel()]
    p, _ = forward(params, pts)
    return xs, ys, p.reshape(n, n)


def count_params(params):
    return int(sum(v.size for v in params.values()))


def main():
    params, snapshots, history, (Xtr, ytr, Xte, yte) = train_adam()
    final = {k: v.copy() for k, v in snapshots[STEPS].items()}
    assert np.allclose(params["W1"], final["W1"]), "final snapshot mismatch"

    grids = {}
    for step in (0, 20, 80, 300, STEPS):
        xs, ys, probs = grid_probs(snapshots[step])
        grids[f"grid_{step}"] = probs

    lr_runs = {}
    for lr in (0.005, 0.5, 12.0):
        losses, diverged = train_sgd(lr)
        lr_runs[f"lr_{lr}"] = np.array(losses)
        lr_runs[f"lr_{lr}_diverged"] = np.array([-1 if diverged is None else diverged])

    metrics = {
        "n_total": int(len(Xtr) + len(Xte)),
        "n_train": int(len(Xtr)),
        "n_test": int(len(Xte)),
        "n_params": count_params(final),
        "param_shapes": {k: list(v.shape) for k, v in final.items()},
        "final_loss": float(history[-1]["loss"]),
        "train_acc": float(history[-1]["train_acc"]),
        "test_acc": float(history[-1]["test_acc"]),
        "steps": STEPS,
        "lr": LR,
        "noise": NOISE,
        "learning_rate_runs": {},
    }
    for lr in (0.005, 0.5, 12.0):
        arr = lr_runs[f"lr_{lr}"]
        div = int(lr_runs[f"lr_{lr}_diverged"][0])
        metrics["learning_rate_runs"][str(lr)] = {
            "loss_start": float(arr[0]),
            "loss_end": float(arr[-1]),
            "loss_min": float(arr.min()),
            "diverged_at": div if div >= 0 else None,
        }
    (OUT / "metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")

    np.savez_compressed(
        OUT / "model.npz",
        Xtr=Xtr, ytr=ytr, Xte=Xte, yte=yte,
        **{f"final_{k}": v for k, v in final.items()},
        **{f"snap{step}_{k}": v for step, snap in snapshots.items() for k, v in snap.items()},
        xs=xs, ys=ys,
        **grids,
        history_step=np.array([h["step"] for h in history]),
        history_loss=np.array([h["loss"] for h in history]),
        history_test_loss=np.array([h["test_loss"] for h in history]),
        history_train_acc=np.array([h["train_acc"] for h in history]),
        history_test_acc=np.array([h["test_acc"] for h in history]),
        **lr_runs,
    )
    print(json.dumps(metrics, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
