#!/usr/bin/env python3
"""
Cluster Consolidated Findings

Clusters consolidated review findings using agglomerative clustering with
Ward linkage and code citation augmentation. Produces one JSON file per
cluster in the output directory.
"""

import os
import sys
import json
import argparse
import numpy as np
from pathlib import Path
from openai import OpenAI
from sklearn.cluster import AgglomerativeClustering
from sklearn.preprocessing import normalize
from scipy.cluster.hierarchy import linkage, fcluster

# ============================================================================
# CONFIGURATION
# ============================================================================

EMBEDDING_MODEL = "text-embedding-3-large"
BATCH_SIZE = 500
MAX_CLUSTER_SIZE = 80
FINDINGS_PER_CLUSTER = 50  # ~1 cluster per N findings
MIN_CLUSTERS = 5

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def render_finding_text(finding):
    """Render a finding as plain text for embedding."""
    status = finding.get("status", "unknown")
    confidence = finding.get("confidence", "unknown")
    run_count = finding.get("runCount", 0)
    total_runs = finding.get("totalRuns", 0)

    # Collect all code citations across sub-findings
    citations = set()
    areas = set()
    first_comment = ""

    for f in finding.get("findings", []):
        for c in f.get("codeCitations", []):
            citations.add(c)
        for a in f.get("applicableAreas", []):
            areas.add(a)
        if not first_comment and f.get("comment"):
            first_comment = f["comment"]

    # Truncate comment to ~200 chars
    if len(first_comment) > 200:
        first_comment = first_comment[:200].rsplit(" ", 1)[0] + "..."

    parts = [f"[{status}] (confidence: {confidence}, {run_count}/{total_runs} runs)"]

    if citations:
        parts.append(f"Citations: {'; '.join(sorted(citations))}")
    if areas:
        parts.append(f"Areas: {'; '.join(sorted(areas))}")
    if first_comment:
        parts.append(f"Comment: {first_comment}")

    return " — ".join(parts)


def generate_embeddings(texts, cache_path, api_key):
    """Generate embeddings via OpenAI API with caching."""
    print("\n=== Generating Embeddings ===")

    if cache_path.exists():
        print(f"Using cached embeddings from {cache_path}")
        embeddings = np.load(cache_path)
        if len(embeddings) == len(texts):
            print(f"Loaded {len(embeddings)} embeddings from cache")
            return embeddings
        print(f"Cache size mismatch ({len(embeddings)} vs {len(texts)}), regenerating")

    # Estimate cost
    num_texts = len(texts)
    avg_tokens = 80
    total_tokens = num_texts * avg_tokens
    cost_per_million = 0.13
    estimated_cost = (total_tokens / 1_000_000) * cost_per_million

    print(f"Generating embeddings for {num_texts} findings")
    print(f"Estimated cost: ${estimated_cost:.4f} (~{avg_tokens} tokens/finding x ${cost_per_million}/1M tokens)")

    client = OpenAI(api_key=api_key)
    embeddings = []
    num_batches = (num_texts + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, num_texts, BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        print(f"  Batch {batch_num}/{num_batches} ({len(batch)} items)... ", end="", flush=True)

        response = client.embeddings.create(model=EMBEDDING_MODEL, input=batch)
        batch_embeddings = [item.embedding for item in response.data]
        embeddings.extend(batch_embeddings)
        print("done")

    embeddings = np.array(embeddings)
    np.save(cache_path, embeddings)
    print(f"Saved {len(embeddings)} embeddings to {cache_path}")

    return embeddings


def build_citation_features(findings):
    """Build binary code-citation feature matrix, excluding generic citations."""
    # Count citation frequency to identify generic catch-alls
    from collections import Counter
    citation_counts = Counter()
    for finding in findings:
        for f in finding.get("findings", []):
            for c in f.get("codeCitations", []):
                citation_counts[c] += 1

    # Exclude citations that appear in >10% of findings — too generic to be useful signal
    max_freq = len(findings) * 0.10
    excluded = {c for c, count in citation_counts.items() if count > max_freq}
    all_citations = {c for c in citation_counts if c not in excluded}

    if excluded:
        print(f"  Excluded {len(excluded)} generic citations (>10% frequency): {sorted(excluded)}")

    if not all_citations:
        return None

    sorted_citations = sorted(all_citations)
    citation_index = {c: i for i, c in enumerate(sorted_citations)}

    print(f"  Unique code citations: {len(sorted_citations)}")

    # Build binary matrix
    matrix = np.zeros((len(findings), len(sorted_citations)), dtype=np.float64)
    for row, finding in enumerate(findings):
        for f in finding.get("findings", []):
            for c in f.get("codeCitations", []):
                if c in citation_index:
                    matrix[row, citation_index[c]] = 1.0

    return matrix


def build_feature_matrix(embeddings, findings):
    """Build augmented feature matrix: normalized embeddings + weighted citation features."""
    print("\n=== Building Feature Matrix ===")

    # Normalize embeddings to unit norm
    norm_embeddings = normalize(embeddings, norm="l2")
    print(f"  Embedding dimensions: {norm_embeddings.shape[1]}")

    # Build citation features
    citation_matrix = build_citation_features(findings)

    if citation_matrix is not None and citation_matrix.shape[1] > 0:
        # Normalize citation features, then weight 3x
        citation_norms = np.linalg.norm(citation_matrix, axis=1, keepdims=True)
        citation_norms[citation_norms == 0] = 1.0
        norm_citations = citation_matrix / citation_norms
        weighted_citations = norm_citations * 3.0

        features = np.hstack([norm_embeddings, weighted_citations])
        print(f"  Citation dimensions: {citation_matrix.shape[1]} (weighted 3x)")
    else:
        features = norm_embeddings
        print("  No code citations found, using embeddings only")

    print(f"  Total feature dimensions: {features.shape[1]}")
    return features, norm_embeddings.shape[1]



def enforce_size_bounds(features, labels, max_size, embedding_dims):
    """Sub-cluster any clusters larger than max_size using embeddings-only features.
    Repeats until all clusters comply — a single maxclust split can be uneven."""
    from scipy.cluster.hierarchy import linkage as sub_linkage, fcluster as sub_fcluster

    new_labels = labels.copy()
    next_label = max(set(new_labels)) + 1

    changed = True
    while changed:
        changed = False
        for label in sorted(set(new_labels)):
            mask = new_labels == label
            size = mask.sum()
            if size <= max_size:
                continue

            changed = True
            indices = np.where(mask)[0]
            # Use only embedding dimensions (strip citation features) to avoid
            # the same citation-dominated clustering that created the mega-cluster
            cluster_features = features[indices, :embedding_dims]

            n_sub = (size + max_size - 1) // max_size
            Z_sub = sub_linkage(cluster_features, method="ward")
            sub_labels = sub_fcluster(Z_sub, t=n_sub, criterion="maxclust")

            # fcluster labels are 1-based
            unique_subs = sorted(set(sub_labels))
            sub_sizes = []
            for i, sub_id in enumerate(unique_subs):
                sub_mask = sub_labels == sub_id
                sub_indices = indices[sub_mask]
                sub_sizes.append(int(sub_mask.sum()))

                if i == 0:
                    new_labels[sub_indices] = label
                else:
                    new_labels[sub_indices] = next_label
                    next_label += 1

            print(f"  Split cluster (size {size}) into {len(unique_subs)} sub-clusters: {sub_sizes}")

    return new_labels


def _index_to_suffix(j):
    """Convert 0-based index to alphabetic suffix: 0→a, 25→z, 26→aa, 27→ab, ..."""
    s = ""
    while True:
        s = chr(ord('a') + j % 26) + s
        j = j // 26 - 1
        if j < 0:
            break
    return s


def export_clusters(findings, pre_split_labels, final_labels, output_dir):
    """Export one JSON file per semantic cluster, splitting oversized ones into sub-files.

    Uses pre_split_labels to identify semantic clusters and final_labels to identify
    sub-clusters created by enforce_size_bounds. Produces:
      - N.json for clusters that weren't split
      - N-a.json, N-b.json, ... for clusters that were split
    """
    print("\n=== Exporting Clusters ===")

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Group findings by pre-split (semantic) label
    semantic_groups = {}
    for i, (finding, pre_label) in enumerate(zip(findings, pre_split_labels)):
        pre_label = int(pre_label)
        if pre_label not in semantic_groups:
            semantic_groups[pre_label] = []
        semantic_groups[pre_label].append((i, finding))

    # Sort semantic groups by size descending, assign sequential numbers 1..N
    sorted_groups = sorted(semantic_groups.items(), key=lambda x: len(x[1]), reverse=True)

    sizes = []
    split_count = 0
    for cluster_num, (_, group) in enumerate(sorted_groups, 1):
        # Check if this semantic group was split by enforce_size_bounds
        # (i.e., its findings have multiple distinct final labels)
        sub_groups = {}
        for idx, finding in group:
            final_label = int(final_labels[idx])
            if final_label not in sub_groups:
                sub_groups[final_label] = []
            sub_groups[final_label].append(finding)

        if len(sub_groups) == 1:
            # Not split — write as N.json
            all_findings = [finding for _, finding in group]
            out_file = output_path / f"{cluster_num}.json"
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(all_findings, f, indent=2)
            sizes.append(len(all_findings))
        else:
            # Split — write each sub-group as N-a.json, N-b.json, ...
            split_count += 1
            # Sort sub-groups by size descending for consistent lettering
            sorted_subs = sorted(sub_groups.values(), key=len, reverse=True)
            sub_sizes = []
            for j, sub_findings in enumerate(sorted_subs):
                suffix = _index_to_suffix(j)
                out_file = output_path / f"{cluster_num}-{suffix}.json"
                with open(out_file, "w", encoding="utf-8") as f:
                    json.dump(sub_findings, f, indent=2)
                sizes.append(len(sub_findings))
                sub_sizes.append(len(sub_findings))
            print(f"  Cluster {cluster_num}: split into {len(sorted_subs)} sub-files ({', '.join(str(s) for s in sub_sizes)} findings)")

    print(f"  Exported {len(sorted_groups)} semantic clusters ({split_count} split) as {len(sizes)} files")
    return sizes, split_count


def print_summary(sizes, total_findings, split_count=0):
    """Print clustering summary statistics."""
    print("\n" + "=" * 60)
    print("CLUSTERING RESULTS")
    print("=" * 60)
    print(f"Total findings:  {total_findings}")
    print(f"Output files:    {len(sizes)}")
    if split_count > 0:
        print(f"Split clusters:  {split_count} (will be rejoined after structuring)")
    print(f"Size range:      {min(sizes)}-{max(sizes)}")
    print(f"Mean size:       {np.mean(sizes):.1f}")
    print(f"Median size:     {np.median(sizes):.0f}")
    print(f"Singletons:      {sum(1 for s in sizes if s == 1)}")

    # Size distribution
    brackets = [(1, 5), (6, 10), (11, 15), (16, 20), (21, 30), (31, 50), (51, 100)]
    print("\nSize distribution:")
    for lo, hi in brackets:
        count = sum(1 for s in sizes if lo <= s <= hi)
        if count > 0:
            label = str(lo) if lo == hi else f"{lo}-{hi}"
            print(f"  {label:>5} findings: {count} files")

    print("=" * 60)


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Cluster consolidated review findings using agglomerative clustering"
    )
    parser.add_argument("--inputFile", required=True, help="Path to consolidated-findings.json")
    parser.add_argument("--outputFolder", required=True, help="Directory for cluster output files")
    parser.add_argument("--maxClusterSize", type=int, default=MAX_CLUSTER_SIZE, help="Max findings per cluster file (default: %(default)s)")
    args = parser.parse_args()

    # Validate
    input_path = Path(args.inputFile)
    if not input_path.exists():
        print(f"Error: Input file not found: {args.inputFile}", file=sys.stderr)
        sys.exit(1)

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    # Load findings
    print("=== Loading Findings ===")
    with open(input_path, "r", encoding="utf-8") as f:
        findings = json.load(f)

    print(f"Loaded {len(findings)} findings from {input_path.name}")

    if len(findings) < 2:
        print("Too few findings to cluster, writing single output file")
        output_path = Path(args.outputFolder)
        output_path.mkdir(parents=True, exist_ok=True)
        with open(output_path / "1.json", "w", encoding="utf-8") as f:
            json.dump(findings, f, indent=2)
        return

    # Render text summaries
    texts = [render_finding_text(finding) for finding in findings]

    # Generate embeddings
    cache_path = input_path.parent / "embeddings.npy"
    embeddings = generate_embeddings(texts, cache_path, api_key)

    # Build augmented feature matrix
    features, embedding_dims = build_feature_matrix(embeddings, findings)

    # Dynamic target: ~1 cluster per FINDINGS_PER_CLUSTER findings
    target = max(MIN_CLUSTERS, len(findings) // FINDINGS_PER_CLUSTER)
    print(f"\n=== Cluster Target ===")
    print(f"  {len(findings)} findings / {FINDINGS_PER_CLUSTER} = target {target} clusters")

    # Cluster using maxclust criterion for predictable count
    print(f"\n=== Clustering ===")
    Z = linkage(features, method="ward")
    labels = fcluster(Z, t=target, criterion="maxclust")

    n_clusters = len(set(labels))
    largest = max(np.bincount(labels)[1:])
    print(f"  Initial clusters: {n_clusters}, max size: {largest}")

    # Save pre-split labels so export can track which clusters were split
    max_size = args.maxClusterSize
    pre_split_labels = labels.copy()

    # Sub-split any cluster that would exceed size limit
    labels = enforce_size_bounds(features, labels, max_size, embedding_dims)

    n_final = len(set(labels))
    print(f"Final clusters: {n_final} (max size: {max_size})")

    # Export with split-file naming for oversized clusters
    sizes, split_count = export_clusters(findings, pre_split_labels, labels, args.outputFolder)

    # Summary
    print_summary(sizes, len(findings), split_count)
    print("\nDone.")


if __name__ == "__main__":
    main()
