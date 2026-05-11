# Local LLMs on a Mac mini

**Status:** Research notes, May 2026.
**Question:** What free, open-source LLMs can I run locally on a Mac mini (M4, possibly M5), and how do they compare to Claude Haiku / Sonnet / Opus 4.x?

---

## TL;DR

1. **Yes, this is viable.** A Mac mini with 32–64 GB unified memory will comfortably run modern 7B–32B open-weight models, and an M4 Pro with 64 GB can squeeze in a Q4-quantized Llama 3.3 70B or Qwen 3 32B with usable throughput.
2. **The ceiling is memory bandwidth, not compute.** On Apple Silicon, token-generation speed is dominated by how fast the GPU/Neural Engine can stream weights out of unified memory. The M4 base is ~120 GB/s, the M4 Pro ~273 GB/s, the M5 base ~154 GB/s, the M5 Pro ~307 GB/s.
3. **Software stack:** use **Ollama** for ergonomics (which now uses MLX under the hood since 0.19, March 2026), **MLX directly** for max throughput, **llama.cpp** for control and portability. **LM Studio** is the polished GUI.
4. **Honest comparison vs Claude:** the best open-weight models you can fit on a 64 GB Mac mini (Qwen 3.6-27B, Llama 4 Scout, DeepSeek-V3 distills) land roughly in the **Haiku 4.5 / Sonnet 4.6** range on coding and knowledge benchmarks — with Qwen 3.6-27B notably tying Sonnet 4.6 on SWE-bench Verified per Qwen's own numbers. **Opus 4.7 is not reachable locally** at any quantization that fits a Mac mini; the frontier reasoning gap is real.
5. **Best one-line recommendation** for a 32 GB Mac mini: **Qwen 3 14B** (Apache 2.0) via Ollama. For 64 GB M4 Pro: **Qwen 3.6-27B** or **Llama 3.3 70B Q4** depending on whether you optimize for throughput or absolute quality.

---

## 1. Mac mini hardware reality

For LLM inference, three numbers matter, in this order:

| What | Why |
|---|---|
| **Unified memory size** | Hard ceiling on what model + KV cache fits |
| **Memory bandwidth** | Soft ceiling on tokens/second (weights stream every token) |
| **Compute (GPU/ANE cores)** | Matters most for prefill / prompt processing, less for generation |

### Current Mac mini configurations (as of May 2026)

| Chip | Memory tiers | Bandwidth | Notes |
|---|---|---|---|
| **M4** | 16 / 24 / 32 GB | 120 GB/s | LPDDR5X — base model, shipped Oct 2024 |
| **M4 Pro** | up to 64 GB | 273 GB/s | The sweet spot for local LLM work |
| **M5** | up to 32 GB | 153.6 GB/s | LPDDR5X 9600 MT/s, ~30% faster than M4 |
| **M5 Pro** | up to 64 GB | 307 GB/s | ~12% faster than M4 Pro |
| **M5 Max** | up to 128 GB | 614 GB/s | Not in Mac mini lineup |

**Status as of 2026-05-08:** M5 / M5 Pro / M5 Max shipped in MacBook Pro and MacBook Air in March 2026. The M5 Mac mini was **notably absent** from that announcement and is rumored for later in 2026 — so if your machine is recent but not brand-new, it's almost certainly an M4. Verify with `system_profiler SPHardwareDataType | grep "Chip"`.

### Practical model-size limits on Apple Silicon

At Q4 quantization (the standard for local inference), expect ~0.5–0.6 GB of memory per billion parameters, plus context/KV cache overhead, plus 4–8 GB for the OS:

| Model size (Q4) | Approx VRAM | Comfortable on |
|---|---|---|
| 7–8B | 6–7 GB | 16 GB+ Mac mini |
| 12–14B | 10–12 GB | 24 GB+ Mac mini |
| 27–32B | 22–24 GB | 32 GB tight, 48 GB+ comfortable |
| 70B | 40–48 GB | 64 GB M4 Pro / M5 Pro only |
| 100B+ MoE | 60+ GB | 64 GB tight; 128 GB ideal (not Mac mini) |
| 235B MoE / 671B MoE | 140+ GB | Not feasible on a single Mac mini |

---

## 2. Software runtimes

| Tool | Best for | Notes |
|---|---|---|
| **Ollama** | Day-to-day use, scripts | One-line `ollama run qwen3:14b`. As of v0.19 (March 2026), uses MLX backend on Apple Silicon with 32 GB+ — closes most of the gap with raw MLX. |
| **MLX** | Performance ceiling | Apple's own framework. ~15–30% faster than Ollama on Apple Silicon, ~10% lower memory. Best when you care about every token/sec. |
| **llama.cpp** | Portability, fine control | The original. Slower than MLX on Apple Silicon (~38–48 tok/s vs ~45–58 tok/s for Llama 3.1 8B Q4 on M2 Pro), but runs anywhere. |
| **LM Studio** | GUI, exploration | Polished desktop app, great for trying models without CLI. |

Recommended setup: install **Ollama** first (covers 95% of cases), drop into **MLX** for performance-sensitive workloads.

---

## 3. Open-source model landscape (May 2026)

The serious contenders, by family. License column matters: Apache 2.0 / MIT are unrestricted; Llama Community License has user-count restrictions and EU vision restrictions; Gemma has its own permissive-but-not-OSI license.

| Model | Params (active / total) | License | Strengths | Fits on Mac mini? |
|---|---|---|---|---|
| **Qwen 3 8B** | 8B | Apache 2.0 | Best small model, multilingual | 16 GB+ |
| **Qwen 3 14B** | 14B | Apache 2.0 | **Sweet spot for 32 GB minis** | 32 GB+ |
| **Qwen 3 32B** | 32B | Apache 2.0 | Strong reasoning, coding | 48 GB+ |
| **Qwen 3.6-27B** (Apr 2026) | 27B dense | Apache 2.0 | **SWE-bench 77.2 — ties Sonnet 4.6** | 48 GB+ |
| **Qwen 3 235B-A22B** | 22B / 235B MoE | Apache 2.0 | Frontier-class but huge | No (single mini) |
| **Llama 4 Scout** | 17B / 109B MoE | Llama Community | 10M-token context, multimodal | 64 GB at Q4 |
| **Llama 4 Maverick** | 17B / 400B MoE | Llama Community | Bigger Scout sibling | No |
| **Llama 3.3 70B** | 70B | Llama Community | Mature, well-tooled, GPT-4-class | 64 GB at Q4 (~5 tok/s) |
| **DeepSeek-V3** | 37B / 671B MoE | MIT | Best open MMLU (88.5), reasoning | No (full); distills available |
| **DeepSeek-R1** | 37B / 671B MoE | MIT | Reasoning specialist, MMLU 90.8 | No (full); distills available |
| **Gemma 3 12B** | 12B | Gemma (Apache-like) | Multimodal, 128k context, 140 langs | 24 GB+ |
| **Gemma 3 27B** | 27B | Gemma (Apache-like) | LMArena top compact open model (1338) | 48 GB+ |
| **Phi-4 14B** | 14B | MIT | Strong for size, MS Research | 24 GB+ |

### License at a glance

- **Apache 2.0 / MIT** — Qwen, DeepSeek, Phi: unrestricted commercial use.
- **Llama Community License** — Llama 3 / 4: free unless you have >700M MAU; EU users cannot use the *vision* features of Llama 4.
- **Gemma terms** — Permissive, similar to Apache 2.0 in practice but technically Google's own terms.

All are "free to use" for individual / small-team use. None require payment. None require an internet connection after download.

---

## 4. Benchmark comparison: open-weight vs Claude

> ⚠️ Benchmark caveat: numbers come from each lab's own reports. Different prompting / shot counts / harness versions; treat differences <5 points with skepticism. Claude Opus 4.7 numbers from official Anthropic release. Open-source numbers from model cards and Artificial Analysis replications where available.

### Coding (SWE-bench Verified — higher is better)

| Model | SWE-bench Verified | Runs locally? |
|---|---|---|
| **Claude Opus 4.7** | **87.6%** | No (API only) |
| **Claude Opus 4.6** | 80.8% | No |
| **Claude Sonnet 4.6** | 79.6% | No |
| **Qwen 3.6-27B** | **77.2%** | ✅ 48 GB+ |
| **Claude Haiku 4.5** | 73.3% | No |
| Llama 3.3 70B (est.) | ~50–55% | ✅ 64 GB at Q4 |
| Llama 4 Scout | ~50% (est.) | ✅ 64 GB at Q4 |
| Gemma 3 27B | ~30% (LiveCodeBench 29.7) | ✅ 48 GB+ |

**Standout:** Qwen 3.6-27B essentially matches Sonnet 4.6 on agentic coding while fitting in 48 GB of unified memory.

### Knowledge & reasoning (GPQA Diamond — higher is better)

| Model | GPQA Diamond | Runs locally? |
|---|---|---|
| **Claude Opus 4.7** | **94.2%** | No |
| **Claude Opus 4.6** | 91.3% | No |
| **Claude Sonnet 4.6** | 74.1% | No |
| Llama 4 Scout | 57.2% | ✅ |
| Gemma 3 27B | 42.4% | ✅ |
| Qwen 3 32B (est.) | ~50% | ✅ |

**Reality check:** Opus 4.7 is in a different class on GPQA — frontier scientific reasoning is the gap that hasn't closed.

### General knowledge (MMLU / MMLU-Pro — higher is better)

| Model | MMLU | MMLU-Pro | Runs locally? |
|---|---|---|---|
| DeepSeek-R1 | **90.8** | — | Distills only on Mac mini |
| DeepSeek-V3 | 88.5 | — | Distills only |
| Qwen 3-235B-A22B | 87.8 | 68.2 | No (too big) |
| Llama 4 Scout | — | 74.3 | ✅ |
| Gemma 3 27B | — | 67.5 | ✅ |
| Qwen 3-32B | — | 65.5 | ✅ |

(Anthropic doesn't publish MMLU/MMLU-Pro for the 4.x line consistently — they've shifted to GPQA/SWE-bench/AIME as their reporting basis.)

---

## 5. Throughput on Mac mini hardware

Real numbers from public benchmarks (Q4_K_M unless noted):

| Model | Hardware | Tokens/sec |
|---|---|---|
| Llama 3.3 70B (~40 GB) | M4 Pro 64 GB, MLX | ~5 |
| Qwen 2.5 32B 4-bit | M4 Pro 48 GB, MLX | 32–38 |
| Qwen 2.5 Coder 32B | M4 Pro 64 GB, Ollama (older) | ~11 |
| Llama 3.1 8B Q4 | M2 Pro, llama.cpp | 38–48 |
| Llama 3.1 8B Q4 | M2 Pro, MLX | 45–58 |
| ≤14B models | M4 Pro | 100+ |

**Rule of thumb:** ≤14B feels instant; 27–32B feels conversational; 70B feels slow but usable for non-interactive tasks (batch summarization, code review).

---

## 6. Recommendations by Mac mini config

### 16 GB Mac mini (M4, base)
- **Qwen 3 8B** (Apache 2.0) — best small model right now.
- **Phi-4 14B Q4** is borderline; might OOM with large contexts.
- Fall back to Claude API for harder tasks.

### 24 GB Mac mini (M4)
- **Qwen 3 14B** (Apache 2.0) — sweet spot.
- **Gemma 3 12B** for multimodal (vision-language).
- 30B models technically run but uncomfortably slow / tight.

### 32 GB Mac mini (M4)
- **Qwen 3 14B** for daily driver.
- **Qwen 3.6-27B Q4** (~16 GB) is the upgrade pick — matches Sonnet 4.6 on coding.

### 48 GB Mac mini M4 Pro
- **Qwen 3.6-27B** in higher precision (Q5/Q6) for quality, or
- **Qwen 2.5/3 32B Q4** at ~30+ tok/s.

### 64 GB Mac mini M4 Pro / M5 Pro
- **Llama 3.3 70B Q4** if you want the biggest model that fits (~5 tok/s — non-interactive).
- **Qwen 3.6-27B at Q8** for quality without the speed hit.
- **Llama 4 Scout Q4** for the 10M-token context window.

---

## 7. Honest takeaway

For day-to-day coding and knowledge work, a 64 GB M4 Pro Mac mini running **Qwen 3.6-27B** via Ollama is genuinely competitive with Claude Haiku 4.5 / Sonnet 4.6 on most tasks — with the caveats that:

- **Frontier reasoning** (long agentic coding loops, GPQA-style hard science): Opus 4.7 is meaningfully better and not reachable locally.
- **Throughput** at 27B+ is substantially below API latency. Streaming a 70B model at 5 tok/s feels noticeably slower than Haiku 4.5 at hundreds of tok/s through the API.
- **Cost** flips the comparison: a 64 GB M4 Pro Mac mini is a one-time ~$2,000 purchase; the same workload on Claude API at scale runs into hundreds-to-thousands per month depending on tokens.
- **Privacy / offline** is the killer feature local models actually win on — no data leaves the box, no internet needed after download.

If the goal is "replace Claude on this hardware": you'll be happy ~70% of the time and miss Opus on the hard 30%. If the goal is "have a free, private model that's good enough for most tasks": this is now a solved problem.

---

## Sources

### Mac mini & Apple Silicon
- [Mac mini - Technical Specifications - Apple](https://www.apple.com/mac-mini/specs/)
- [Apple M4 - Wikipedia](https://en.wikipedia.org/wiki/Apple_M4)
- [Apple M5 - Wikipedia](https://en.wikipedia.org/wiki/Apple_M5)
- [Apple introduces M4 Pro and M4 Max](https://www.apple.com/newsroom/2024/10/apple-introduces-m4-pro-and-m4-max/)
- [Mac Mini M4 for AI 2026 — LLM Benchmarks & Review (Compute Market)](https://www.compute-market.com/blog/mac-mini-m4-for-ai-apple-silicon-2026)
- [M5 Mac mini release rumors (Macworld)](https://www.macworld.com/article/2964754/2026-mac-mini-m5-pro-design-specs-release-date.html)
- [Running 32B Models in 2026: Mac mini M4 Pro vs. Mac Studio (MACGPU)](https://macgpu.com/en/blog/2026-mac-mini-m4-pro-vs-mac-studio-32b-llm-hardware-selection-matrix.html)

### Runtimes
- [Ollama is now powered by MLX on Apple Silicon (Ollama Blog)](https://ollama.com/blog/mlx)
- [llama.cpp vs MLX vs Ollama vs vLLM (Contra Collective)](https://contracollective.com/blog/llama-cpp-vs-mlx-ollama-vllm-apple-silicon-2026)
- [MLX vs Ollama on Apple Silicon (2026)](https://willitrunai.com/blog/mlx-vs-ollama-apple-silicon-benchmarks)
- [LM Studio](https://lmstudio.ai/)

### Models — Llama 4
- [Welcome Llama 4 Maverick & Scout (Hugging Face)](https://huggingface.co/blog/llama4-release)
- [Llama 4 Complete Developer Guide (Codersera)](https://codersera.com/blog/llama-4-complete-guide-2026/)
- [Llama 4 Model Cards](https://www.llama.com/docs/model-cards-and-prompt-formats/llama4/)

### Models — Qwen 3 / 3.5 / 3.6
- [Qwen3 Technical Report (arXiv)](https://arxiv.org/pdf/2505.09388)
- [Qwen3.6-27B (Hugging Face)](https://huggingface.co/Qwen/Qwen3.6-27B)
- [Qwen3.6-27B Beats 397B on Coding (Build Fast With AI)](https://www.buildfastwithai.com/blogs/qwen3-6-27b-review-2026)
- [Alibaba Qwen Team Releases Qwen3.6-27B (MarkTechPost)](https://www.marktechpost.com/2026/04/22/alibaba-qwen-team-releases-qwen3-6-27b-a-dense-open-weight-model-outperforming-397b-moe-on-agentic-coding-benchmarks/)
- [Qwen3-235B-A22B-Thinking (Hugging Face)](https://huggingface.co/Qwen/Qwen3-235B-A22B-Thinking-2507)

### Models — DeepSeek
- [DeepSeek-V3 Technical Report (arXiv)](https://arxiv.org/html/2412.19437v1)
- [DeepSeek-R1 (arXiv)](https://arxiv.org/html/2501.12948v1)
- [DeepSeek-R1 GitHub](https://github.com/deepseek-ai/DeepSeek-R1)

### Models — Gemma 3
- [Gemma 3 (Google Blog)](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-3/)
- [Gemma 3 Model Card](https://ai.google.dev/gemma/docs/core/model_card_3)
- [Welcome Gemma 3 (Hugging Face)](https://huggingface.co/blog/gemma3)

### Claude benchmarks
- [Claude Opus 4.7 Benchmarks Explained (Vellum)](https://www.vellum.ai/blog/claude-opus-4-7-benchmarks-explained)
- [Claude Benchmarks 2026 (MorphLLM)](https://www.morphllm.com/claude-benchmarks)
- [LLM Benchmarks 2026: 30+ Models Ranked (Iternal)](https://iternal.ai/llm-selection-guide)

### Mac mini throughput
- [bharani manoharan: Llama 3.3 70B MLX on M4 Pro 64 GB](https://x.com/phreakv6/status/1867117812822708366)
- [Best Mac Mini for Running Local LLMs (Starmorph)](https://blog.starmorph.com/blog/best-mac-mini-for-local-llms)
- [Performance of llama.cpp on Apple Silicon (GitHub Discussion)](https://github.com/ggml-org/llama.cpp/discussions/4167)

### Memory sizing
- [LM Studio VRAM Requirements](https://localllm.in/blog/lm-studio-vram-requirements-for-local-llms)
- [Can You Run This LLM? VRAM Calculator (apxml)](https://apxml.com/tools/vram-calculator)
- [Best Local LLMs to Run on Apple Silicon Mac in 2026 (apxml)](https://apxml.com/posts/best-local-llms-apple-silicon-mac)
