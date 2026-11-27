#!/usr/bin/env python3
"""Run a small, deterministic CPU demonstration of low-rank matrix arithmetic.

This is original illustrative NumPy code. It does not reproduce Pufferfish,
train nanochat, load model weights, measure speed or estimate a benchmark score.
The synthetic matrices deliberately include both an easy-to-compress example
and a random full-rank control. Their contrasting errors are the result.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import sys
from zoneinfo import ZoneInfo

import numpy as np


SEED = 20261127
BASELINE_COMMIT = "a825e63f81e62e2e9fd38655e9b2e39417620545"


def relative_error(reference: np.ndarray, approximation: np.ndarray) -> float:
    """Frobenius norm error, divided by the norm of the reference array."""
    denominator = float(np.linalg.norm(reference, ord="fro"))
    if denominator == 0:
        raise ValueError("This demonstration requires a non-zero reference.")
    return float(np.linalg.norm(reference - approximation, ord="fro") / denominator)


def parameter_counts(rows: int, columns: int, rank: int) -> dict:
    """Count weights only: dense rows*columns versus rank*(rows+columns)."""
    dense = rows * columns
    factored = rank * (rows + columns)
    return {
        "dense_weights": dense,
        "factored_weights": factored,
        "weight_reduction_percent": 100.0 * (1.0 - factored / dense),
        "biases_counted": False,
    }


def svd_experiment(name: str, weights: np.ndarray, inputs: np.ndarray) -> dict:
    """Compare a rank sweep against the same dense matrix and fixed inputs."""
    left, singular_values, right_t = np.linalg.svd(weights, full_matrices=False)
    dense_outputs = inputs @ weights
    rows, columns = weights.shape
    results = []
    for rank in (8, 16, 32, 64, 128):
        # Split each retained singular value equally between the two factors.
        # Their product is the usual truncated SVD approximation to weights.
        roots = np.sqrt(singular_values[:rank])
        factor_a = left[:, :rank] * roots
        factor_b = roots[:, None] * right_t[:rank, :]
        approximate_weights = factor_a @ factor_b
        factor_outputs = (inputs @ factor_a) @ factor_b
        reconstructed_outputs = inputs @ approximate_weights
        np.testing.assert_allclose(
            factor_outputs, reconstructed_outputs, rtol=1e-11, atol=1e-11
        )
        error = relative_error(weights, approximate_weights)
        # Truncated SVD's squared residual equals discarded singular-value energy.
        expected_error = float(
            np.sqrt(np.sum(singular_values[rank:] ** 2) / np.sum(singular_values ** 2))
        )
        np.testing.assert_allclose(error, expected_error, rtol=1e-9, atol=1e-12)
        results.append({
            "rank": rank,
            "factor_a_shape": list(factor_a.shape),
            "factor_b_shape": list(factor_b.shape),
            **parameter_counts(rows, columns, rank),
            "relative_matrix_frobenius_error": error,
            "relative_output_frobenius_error": relative_error(dense_outputs, factor_outputs),
            "factor_associativity_relative_error": relative_error(
                reconstructed_outputs, factor_outputs
            ),
            "retained_singular_value_energy_fraction": float(
                np.sum(singular_values[:rank] ** 2) / np.sum(singular_values ** 2)
            ),
        })
    errors = [row["relative_matrix_frobenius_error"] for row in results]
    assert all(a >= b - 1e-12 for a, b in zip(errors, errors[1:]))
    assert errors[-1] < 1e-12
    return {
        "name": name,
        "weight_shape": list(weights.shape),
        "input_shape": list(inputs.shape),
        "numerical_rank": int(np.linalg.matrix_rank(weights)),
        "rank_sweep": results,
    }


def run() -> dict:
    rng = np.random.default_rng(SEED)

    # Exact factorisation illustrates associativity without any approximation.
    # This weight matrix is constructed from factors, so it has rank at most 16.
    exact_a = rng.normal(size=(128, 16))
    exact_b = rng.normal(size=(16, 192))
    exact_weights = exact_a @ exact_b
    exact_inputs = rng.normal(size=(32, 128))
    dense_outputs = exact_inputs @ exact_weights
    factored_outputs = (exact_inputs @ exact_a) @ exact_b
    np.testing.assert_allclose(dense_outputs, factored_outputs, rtol=1e-11, atol=1e-11)

    # The structured matrix is full rank but almost all its energy is in 16
    # singular directions. The small non-zero tail makes compression imperfect.
    dimension = 128
    structural_rank = 16
    left_basis, _ = np.linalg.qr(rng.normal(size=(dimension, dimension)))
    right_basis, _ = np.linalg.qr(rng.normal(size=(dimension, dimension)))
    spectrum = np.concatenate((
        np.geomspace(2.0, 0.7, structural_rank),
        np.geomspace(1e-3, 1e-5, dimension - structural_rank),
    ))
    structured = (left_basis * spectrum) @ right_basis.T
    # Equal Frobenius norms make the two matrices' absolute scales comparable.
    # Relative errors are scale invariant, but this also avoids a visual trap.
    random_control = rng.normal(size=(dimension, dimension))
    random_control *= np.linalg.norm(structured) / np.linalg.norm(random_control)
    shared_inputs = rng.normal(size=(64, dimension))
    experiments = [
        svd_experiment("synthetic_low_rank_structure_with_small_full_rank_tail", structured, shared_inputs),
        svd_experiment("synthetic_random_full_rank_control", random_control, shared_inputs),
    ]
    structured_at_16 = experiments[0]["rank_sweep"][1]
    random_at_16 = experiments[1]["rank_sweep"][1]
    assert structured_at_16["relative_matrix_frobenius_error"] < 0.01
    assert random_at_16["relative_matrix_frobenius_error"] > 0.60
    assert random_at_16["relative_matrix_frobenius_error"] > (
        100 * structured_at_16["relative_matrix_frobenius_error"]
    )

    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(ZoneInfo("Australia/Melbourne"))
    return {
        "schema_version": 1,
        "experiment": "Synthetic low-rank arithmetic: exact identity and SVD trade-offs",
        "status": "completed_local_cpu_illustration",
        "seed": SEED,
        "generated_at_local": now_local.strftime("%Y/%m/%d %H:%M:%S %Z (UTC%z)"),
        "local_timezone": "Australia/Melbourne",
        "generated_at_utc": now_utc.strftime("%Y/%m/%d %H:%M:%S UTC"),
        "environment": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "platform": platform.platform(),
            "machine": platform.machine(),
            "device_used": "CPU via NumPy",
            "dtype": "float64",
        },
        "source_file": "benchmarks/nanochat/pufferfish_demo.py",
        "source_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "scope": {
            "synthetic_data_only": True,
            "gpu_used": False,
            "training_runs": 0,
            "pufferfish_reproduced": False,
            "nanochat_trained": False,
            "core_evaluation_run": False,
            "timing_measured": False,
            "paid_compute_launched": False,
        },
        "exact_factorisation": {
            "input_shape": list(exact_inputs.shape),
            "weight_shape": list(exact_weights.shape),
            "factor_a_shape": list(exact_a.shape),
            "factor_b_shape": list(exact_b.shape),
            "constructed_rank": 16,
            **parameter_counts(128, 192, 16),
            "relative_output_frobenius_error": relative_error(dense_outputs, factored_outputs),
        },
        "truncated_svd": experiments,
        "interpretation": [
            "Low-rank factors can reduce the number of weights while preserving a suitably structured matrix.",
            "At the same rank and weight count, a random full-rank matrix loses substantially more information.",
            "Matrix and output reconstruction errors are not language-model accuracy or CORE scores.",
            "Weight reduction is not a measured training-speed or inference-speed improvement.",
            "At rank 64 these square factors equal the dense weight count; full-rank factors double it.",
            "Results are deterministic in construction; last-bit numerical differences may vary with NumPy and BLAS.",
        ],
        "validation": {
            "exact_factor_output_identity": "passed",
            "truncated_svd_residual_matches_singular_value_tail": "passed",
            "factor_output_associativity": "passed",
            "matrix_error_nonincreasing_with_rank": "passed",
            "full_rank_reconstruction": "passed",
            "structured_and_random_control_have_different_error": "passed",
        },
        "reference_context": {
            "nanochat_record_commit": BASELINE_COMMIT,
            "nanochat_record_url": "https://github.com/karpathy/nanochat/commit/" + BASELINE_COMMIT,
            "pufferfish_source_url": "https://github.com/hwang595/Pufferfish",
            "note": "References motivate the article; this script imports code from neither project.",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path,
        default=Path(__file__).resolve().parent / "results" / "local-demo.json",
        help="Where to write the full JSON receipt (also printed to stdout).",
    )
    args = parser.parse_args()
    result = run()
    encoded = json.dumps(result, indent=2, sort_keys=True, allow_nan=False) + "\n"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(encoded, encoding="utf-8")
    sys.stdout.write(encoded)


if __name__ == "__main__":
    main()
