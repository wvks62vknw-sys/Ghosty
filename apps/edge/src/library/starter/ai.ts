/** Starter library: how modern AI works — key research, frameworks, and learning from feedback. */
import type { StarterDoc } from './types';

export const AI: StarterDoc[] = [
  {
    id: 'ai-evolution',
    title: 'The AI Evolution Archive: Key Research Explained',
    text: `# Foundations (1958-2012)

The perceptron (Rosenblatt, 1958) is a linear classifier trained by an error-correction rule; a single layer cannot learn XOR. Backpropagation (Rumelhart, Hinton and Williams, 1986) trains multi-layer networks with the chain rule. Convolutional networks (LeCun et al., LeNet, 1989-1998) share weights across positions for images. Long short-term memory (Hochreiter and Schmidhuber, 1997) adds gated memory cells so recurrent networks can learn long-range dependencies without vanishing gradients.

AlexNet (Krizhevsky, Sutskever and Hinton, 2012) won ImageNet by a large margin with a deep CNN trained on GPUs, ReLU activations and dropout, starting the deep learning era. Word2vec (Mikolov et al., 2013) learned word embeddings in which vector arithmetic captures meaning. ResNet (He et al., 2015) added residual (skip) connections, y = x + F(x), making networks with 100+ layers trainable. Batch normalisation (Ioffe and Szegedy, 2015) and layer normalisation (Ba et al., 2016) stabilise training. Adam (Kingma and Ba, 2014) became the default optimiser.

# Attention and the Transformer

Sequence-to-sequence models (Sutskever et al., 2014) encoded a sentence into a vector and decoded a translation. Bahdanau et al. (2014) added attention: the decoder looks back at all encoder states weighted by learned relevance.

"Attention Is All You Need" (Vaswani et al., 2017) introduced the Transformer, which drops recurrence entirely. Scaled dot-product attention: Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V, where queries, keys and values are linear projections of the token representations. Multi-head attention runs several attentions in parallel on lower-dimensional projections and concatenates them. Each block is attention plus a position-wise feed-forward network, each wrapped with a residual connection and layer normalisation. Positional encodings (sinusoids) give order information. Decoders use causal masking so a token only attends to earlier tokens. Self-attention costs O(n^2) in sequence length but parallelises across tokens, unlike RNNs.

Later refinements: pre-layer-norm blocks for stability; RMSNorm; SwiGLU feed-forward layers; rotary position embeddings (RoPE, Su et al., 2021) which rotate queries and keys by position-dependent angles and extrapolate better; ALiBi linear position biases; multi-query and grouped-query attention (GQA) sharing keys and values across heads to shrink the KV cache; sliding-window and sparse attention for long contexts.

# Pretraining and scaling

BERT (Devlin et al., 2018) pretrained a bidirectional encoder with masked-language modelling, then fine-tuned it for tasks. GPT (Radford et al., 2018) pretrained a decoder on next-token prediction; GPT-2 (2019, 1.5B parameters) showed zero-shot abilities; GPT-3 (Brown et al., 2020, 175B parameters) showed in-context (few-shot) learning from examples in the prompt. T5 (Raffel et al., 2019) framed every task as text-to-text.

Scaling laws (Kaplan et al., 2020) found loss falls as a power law in parameters, data and compute. Chinchilla (Hoffmann et al., 2022) showed compute-optimal training uses roughly 20 tokens per parameter, so many earlier models were undertrained. Emergent abilities appear as scale grows, though some are artefacts of the metrics used.

# Efficiency

FlashAttention (Dao et al., 2022) computes exact attention without materialising the n x n score matrix: it tiles Q, K and V into blocks that fit in fast on-chip SRAM, uses an online softmax (running max and normaliser) and recomputes in the backward pass, cutting reads and writes to slow GPU high-bandwidth memory. It is IO-aware: the bottleneck is memory traffic, not arithmetic. FlashAttention-2 and -3 improve parallelism and use newer hardware features.

Mixture of Experts (Shazeer et al., 2017; Switch Transformer, Fedus et al., 2021; Mixtral, 2023) replaces the feed-forward layer with many expert networks and a router that sends each token to the top-k experts (often 2). Parameters grow without growing compute per token. Training needs load-balancing losses so experts are used evenly; capacity limits drop or reroute overflow tokens.

Inference: the KV cache stores past keys and values so each new token costs O(n) attention instead of recomputing; memory for the cache often limits batch size (PagedAttention in vLLM manages it like virtual memory pages). Quantisation stores weights in 8, 4 or fewer bits (GPTQ, AWQ, GGUF formats) with small quality loss. Speculative decoding drafts several tokens with a small model and verifies them in one pass of the large model. Distillation trains a small student to imitate a large teacher. LoRA (Hu et al., 2021) fine-tunes by learning low-rank updates W + BA with far fewer trainable parameters; QLoRA (Dettmers et al., 2023) does this on a 4-bit quantised base model.

# Alignment and instruction following

InstructGPT (Ouyang et al., 2022) introduced the standard recipe: supervised fine-tuning on demonstrations, a reward model trained on human preference comparisons, then reinforcement learning (PPO) against the reward model with a KL penalty that keeps the policy near the supervised model (RLHF). Constitutional AI (Bai et al., 2022, Anthropic) used a written set of principles so the model critiques and revises its own outputs and an AI labeller produces preference data: reinforcement learning from AI feedback (RLAIF). Direct Preference Optimisation (Rafailov et al., 2023) optimises the policy on preference pairs directly with a classification-style loss, without a separate reward model or RL loop.

# Reasoning, tools and retrieval

Chain-of-thought prompting (Wei et al., 2022) improves multi-step reasoning by having the model write intermediate steps; self-consistency samples several chains and takes a majority vote. ReAct (Yao et al., 2022) interleaves reasoning with tool actions and observations — the pattern behind agents like Ghosty. Toolformer (2023) taught models to call APIs. Retrieval-augmented generation (RAG; Lewis et al., 2020) retrieves relevant passages from an external store and puts them in the prompt, so knowledge can be updated without retraining and answers can cite sources — Ghosty's library works this way. Reasoning models trained with large-scale reinforcement learning on verifiable tasks (maths, code) learn to think longer before answering; spending more computation at inference ("test-time compute") improves accuracy.

# Other milestones

Generative adversarial networks (Goodfellow et al., 2014); variational autoencoders (Kingma and Welling, 2013); diffusion models (Ho et al., DDPM, 2020) that learn to reverse a gradual noising process, and latent diffusion (Rombach et al., 2022, the basis of Stable Diffusion); CLIP (Radford et al., 2021) aligning images and text in one embedding space; Vision Transformers (Dosovitskiy et al., 2020) treating image patches as tokens; AlphaGo (2016) and AlphaZero (2017) combining deep networks with Monte Carlo tree search and self-play; AlphaFold 2 (2020-2021) predicting protein structures.`,
  },
  {
    id: 'dl-frameworks',
    title: 'Inside Deep Learning Frameworks: PyTorch, JAX, Triton and CUDA',
    text: `# Tensors

A tensor is an n-dimensional array with a dtype (float32, bfloat16, float16, int8...), a device (CPU, CUDA GPU, MPS...), a shape and strides. Strides say how many elements to skip to move one step along each dimension, so transpose and many views change only the strides and share storage without copying. Operations on non-contiguous tensors may need .contiguous(). Broadcasting aligns shapes from the right; size-1 dimensions stretch.

# PyTorch internals

PyTorch executes eagerly: each operation runs immediately. When a tensor requires gradients, every operation records a node in a dynamic computation graph (each output's grad_fn points to the backward function and its inputs). loss.backward() traverses the graph in reverse topological order applying the chain rule and accumulates gradients into .grad of leaf tensors. Call optimizer.zero_grad() each step because gradients accumulate. torch.no_grad() / inference_mode() disable graph recording.

Operations are routed by the dispatcher to kernels per backend and dtype (CPU, CUDA, autograd, autocast...), defined once in a schema (ATen, the C++ tensor library). nn.Module holds parameters and submodules; forward() defines computation. torch.compile (PyTorch 2) uses TorchDynamo to capture Python bytecode into FX graphs, AOTAutograd to trace the backward pass ahead of time, and TorchInductor to generate fused kernels (Triton on GPU, C++ on CPU), often giving large speed-ups. Distributed training: DistributedDataParallel replicates the model and all-reduces gradients; FSDP shards parameters, gradients and optimiser state across GPUs; tensor and pipeline parallelism split single layers or groups of layers.

A minimal training loop:
model.train(); for x, y in loader: opt.zero_grad(); loss = loss_fn(model(x), y); loss.backward(); opt.step(). Evaluate with model.eval() and torch.no_grad(). Mixed precision uses autocast with bfloat16 (or float16 plus a gradient scaler).

# A tiny autograd engine (how it works)

Each Value stores data, grad (initially 0), its parent values and a function that pushes its grad to its parents. For c = a * b the backward function does a.grad += b.data * c.grad and b.grad += a.data * c.grad; for c = a + b it adds c.grad to both. backward() builds a topological order of the graph, sets the output grad to 1 and calls each node's backward function in reverse order. This is reverse-mode automatic differentiation — the same idea PyTorch implements for tensors.

# JAX

JAX transforms pure functions. grad(f) returns a function computing the gradient; jit(f) traces f with abstract values and compiles it with XLA into fused optimised kernels; vmap(f) vectorises over a batch dimension automatically; pmap / sharding APIs distribute across devices. Because tracing runs Python once, functions must be pure (no side effects; randomness through explicit PRNG keys that are split) and control flow that depends on traced values uses lax.cond / lax.scan. Parameters are pytrees (nested dicts, lists and tuples of arrays). Libraries: Flax and Equinox (models), Optax (optimisers).

# Triton

Triton is a Python-based language for writing GPU kernels at the level of blocks rather than individual threads. A kernel (decorated with triton.jit) runs as a grid of program instances; each instance computes its offsets with tl.program_id and tl.arange, loads a block with tl.load (with a mask for the edges), computes on the block, and writes with tl.store. The compiler handles memory coalescing, shared memory and much scheduling. triton.autotune tries configurations (block sizes, number of warps). Fused kernels (for example softmax, layer norm, attention) avoid writing intermediate results to slow global memory.

# CUDA programming model

A CUDA kernel runs on a grid of thread blocks; each block has up to 1024 threads; threads are scheduled in warps of 32 that execute the same instruction (divergent branches within a warp serialise). Memory: registers (per thread), shared memory (per block, fast, explicitly managed, used for tiling), L2 cache, and global memory (large, high bandwidth but high latency). Performance rules: coalesce global memory accesses (consecutive threads read consecutive addresses), reuse data through shared memory (tiled matrix multiplication), avoid shared-memory bank conflicts, keep enough warps in flight to hide latency (occupancy), minimise host-device transfers, and overlap compute with transfers using streams. Tensor Cores perform small matrix multiply-accumulate operations in low precision at very high throughput; libraries such as cuBLAS, cuDNN and CUTLASS use them. Arithmetic intensity (FLOPs per byte moved) decides whether a kernel is compute-bound or memory-bound (roofline model).`,
  },
  {
    id: 'rl-and-evaluation',
    title: 'Reinforcement Learning, Reward Models, RLHF/RLAIF and Automated Evaluation',
    text: `# Reinforcement learning basics

An agent interacts with an environment modelled as a Markov decision process: states s, actions a, transition probabilities, rewards r and a discount factor gamma. A policy pi(a|s) chooses actions; the return is the discounted sum of future rewards. The value function V(s) is the expected return from s; the action-value function Q(s, a) is the expected return after taking a in s. Bellman equation: Q(s, a) = E[r + gamma max_a' Q(s', a')] for the optimal policy.

Value-based methods: Q-learning updates Q(s, a) += alpha (r + gamma max Q(s', .) - Q(s, a)); Deep Q-Networks (Mnih et al., 2015) approximate Q with a neural network plus experience replay and a target network. Exploration: epsilon-greedy, optimism, entropy bonuses.

Policy gradient methods optimise the policy directly. REINFORCE: gradient = E[grad log pi(a|s) * G], where G is the return; subtracting a baseline (for example V(s)) reduces variance without bias, giving the advantage A = G - V(s). Actor-critic methods learn a value function (critic) alongside the policy (actor). Generalised advantage estimation (GAE) trades bias for variance with a parameter lambda.

Proximal Policy Optimisation (PPO; Schulman et al., 2017) limits each update with a clipped objective: L = E[min(ratio * A, clip(ratio, 1 - eps, 1 + eps) * A)], where ratio = pi_new(a|s) / pi_old(a|s), typically eps = 0.2. It is stable and widely used, including for RLHF.

# Reward models and RLHF

A reward model scores a response. Trained on human comparisons (which of two answers is better) with the Bradley-Terry model: P(A preferred over B) = sigmoid(r(A) - r(B)); the loss is -log sigmoid(r(chosen) - r(rejected)). RLHF then optimises the language model to maximise reward minus beta times KL(policy || reference model); the KL term prevents reward hacking and drift. Reward hacking is when the policy exploits flaws in the reward model (length bias, flattery) rather than getting better.

RLAIF replaces human labellers with an AI judge guided by principles (Constitutional AI). DPO removes the explicit reward model: loss = -log sigmoid(beta * (log pi(y_w|x)/pi_ref(y_w|x) - log pi(y_l|x)/pi_ref(y_l|x))). GRPO (group relative policy optimisation) samples several answers per prompt and uses the group's mean and standard deviation of rewards as the baseline, avoiding a learned critic. Verifiable rewards (unit tests passing, exact maths answers) make RL for reasoning and coding reliable because the reward cannot be fooled as easily.

# Automated evaluation and graders

To improve a system you need a measurement you trust. Build an evaluation set of realistic tasks with known good outcomes; keep a held-out set you never tune on. Grade with the most objective check available: exact match or numeric tolerance; unit tests and type checks for code; schema validation for structured output; then rubric-based grading by a strong model (LLM-as-judge) for open-ended answers. Make judges reliable: give a precise rubric with examples, ask for reasoning before the score, compare pairwise rather than scoring absolutely, randomise answer order to avoid position bias, and periodically check the judge against human labels.

Track pass rates over time, look at failures by category, and add every real failure you see to the evaluation set (regression tests). Beware contamination (test items leaking into training data) and Goodhart's law (a measure that becomes a target stops being a good measure).

# Meta-learning

Meta-learning ("learning to learn") trains across many tasks so a model adapts quickly to new ones. MAML (Finn et al., 2017) finds initial parameters from which one or a few gradient steps work well on a new task. Large language models do a form of meta-learning in context: given examples in the prompt they perform the task without weight updates. For an assistant like Ghosty, practical "learning" is retrieval and memory (a library and lessons learned from its own mistakes) plus evaluation loops that check its work.`,
  },
];
