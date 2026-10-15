/** Starter library: the mathematics behind programming and machine learning. */
import type { StarterDoc } from './types';

export const MATH: StarterDoc[] = [
  {
    id: 'mathematics',
    title: 'Mathematics for Programming and AI',
    text: `# Calculus

The derivative f'(x) is the instantaneous rate of change: the limit of (f(x + h) - f(x)) / h as h goes to 0. Rules: power rule d/dx x^n = n x^(n-1); product rule (fg)' = f'g + fg'; quotient rule (f/g)' = (f'g - fg') / g^2; chain rule d/dx f(g(x)) = f'(g(x)) g'(x). Useful derivatives: d/dx e^x = e^x; d/dx ln x = 1/x; d/dx sin x = cos x; sigmoid s(x) = 1 / (1 + e^-x) has s'(x) = s(x)(1 - s(x)); tanh'(x) = 1 - tanh^2(x); ReLU'(x) = 1 for x > 0 else 0.

Partial derivatives hold other variables fixed. The gradient of f(x1..xn) is the vector of partial derivatives; it points in the direction of steepest increase. The Jacobian of a vector function holds all first partial derivatives; the Hessian holds second derivatives (curvature). Backpropagation is the chain rule applied through a computation graph in reverse order, reusing intermediate results (reverse-mode automatic differentiation): one backward pass gives the gradient of a scalar loss with respect to every parameter at about the cost of a forward pass.

Integrals accumulate quantities: the definite integral is the area under a curve; the fundamental theorem of calculus links it to antiderivatives. Numerical integration: trapezoid rule, Simpson's rule, Monte Carlo for high dimensions. Taylor series f(x + h) = f(x) + f'(x)h + f''(x)h^2/2 + ... justify linear and quadratic approximations used in optimisation.

# Linear algebra

Vectors have magnitude and direction; the dot product a.b = sum ai bi = |a||b| cos(theta) measures alignment (cosine similarity = a.b / (|a||b|)). Norms: L1 = sum |xi|, L2 = sqrt(sum xi^2), L-infinity = max |xi|.

A matrix A (m x n) is a linear map from R^n to R^m. Matrix product (AB)ij = sum_k Aik Bkj; it is associative but not commutative; cost O(mnp). Transpose (AB)^T = B^T A^T. The identity I; the inverse A^-1 exists when det(A) is not 0 (columns linearly independent). Solve Ax = b with Gaussian elimination / LU decomposition rather than computing the inverse.

Rank is the number of linearly independent columns. Eigenvectors satisfy Av = lambda v: directions the map only stretches. Symmetric matrices have real eigenvalues and orthogonal eigenvectors (spectral theorem). Positive definite matrices (x^T A x > 0) appear as covariance matrices and Hessians at minima.

Singular value decomposition A = U S V^T works for any matrix: U and V orthogonal, S diagonal with non-negative singular values. Uses: low-rank approximation (keep the largest singular values; the basis of PCA and of LoRA-style low-rank updates), pseudo-inverse, least squares, measuring conditioning. Principal component analysis centres the data and projects it onto the top eigenvectors of the covariance matrix.

In deep learning nearly everything is matrix multiplication: a linear layer computes y = xW + b for a batch x of shape (batch, in) and W of shape (in, out). Attention computes softmax(QK^T / sqrt(d)) V. Broadcasting extends smaller arrays along missing dimensions.

# Probability and statistics

Probability axioms; conditional probability P(A|B) = P(A and B) / P(B); independence P(A and B) = P(A)P(B). Bayes' theorem: P(H|E) = P(E|H) P(H) / P(E) — posterior is likelihood times prior, normalised. Law of total probability: P(E) = sum P(E|Hi) P(Hi).

Random variables: expectation E[X] (linear: E[aX + bY] = aE[X] + bE[Y]); variance Var(X) = E[X^2] - E[X]^2; standard deviation; covariance and correlation. Distributions: Bernoulli, binomial (n trials), geometric, Poisson (counts of rare events, mean = variance = lambda), uniform, normal / Gaussian (mean mu, variance sigma^2; 68-95-99.7 rule), exponential (waiting times, memoryless), categorical (softmax output). The central limit theorem: sums and averages of many independent variables are approximately normal. The law of large numbers: sample means converge to the expectation.

Estimation: maximum likelihood chooses parameters that make the observed data most probable; minimising mean squared error is maximum likelihood under Gaussian noise; minimising cross-entropy is maximum likelihood for categorical outputs. Maximum a posteriori adds a prior (L2 regularisation is a Gaussian prior). Confidence intervals, hypothesis tests and p-values quantify uncertainty; beware multiple comparisons and confusing correlation with causation.

Information theory: entropy H(p) = -sum p log p measures uncertainty (bits with log2). Cross-entropy H(p, q) = -sum p log q is the loss for classification and language modelling; KL divergence KL(p || q) = sum p log(p/q) >= 0 measures how q differs from p (not symmetric). Perplexity = exp(average cross-entropy per token) for language models.

# Discrete mathematics

Logic: propositions, AND/OR/NOT, implication, quantifiers; De Morgan's laws not(a and b) = not a or not b. Proof techniques: direct proof, contrapositive, contradiction, induction (base case plus step: if true for n then for n + 1), strong induction, pigeonhole principle.

Sets and functions; relations (equivalence relations partition a set; partial orders). Combinatorics: permutations n!; arrangements n!/(n-k)!; combinations C(n, k) = n! / (k!(n-k)!); inclusion-exclusion; binomial theorem. Recurrences: solve T(n) = aT(n/b) + f(n) with the master theorem (merge sort T(n) = 2T(n/2) + n gives n log n).

Graph theory vocabulary: degree, path, cycle, connected, tree (connected, acyclic, n - 1 edges), bipartite (two-colourable, no odd cycles), planar, Euler paths (every edge once: zero or two odd-degree vertices), Hamiltonian paths (every vertex once: NP-complete).

Modular arithmetic: (a + b) mod m and (a b) mod m distribute; Fermat's little theorem a^(p-1) = 1 mod p for prime p and a not divisible by p; RSA relies on modular exponentiation and the difficulty of factoring.

# Optimisation

Gradient descent: theta = theta - lr * gradient. Learning rate too high diverges, too low is slow. Stochastic gradient descent uses mini-batches. Momentum accumulates a velocity to damp oscillations. Adam keeps running averages of gradients (m) and squared gradients (v) with bias correction: theta -= lr * m_hat / (sqrt(v_hat) + eps); AdamW decouples weight decay. Learning-rate schedules: warmup then cosine or linear decay.

Convex functions have no bad local minima; neural network losses are non-convex but high-dimensional saddle points, not local minima, are the usual obstacle. Regularisation: weight decay, dropout, early stopping, data augmentation. Constrained optimisation uses Lagrange multipliers. Numerical stability: subtract the max before softmax, use log-sum-exp, compute log-softmax with cross-entropy together, watch for overflow in float16 (use bfloat16 or loss scaling).`,
  },
];
