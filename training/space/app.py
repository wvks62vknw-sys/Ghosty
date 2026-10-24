"""Ghosty's daily GPU: a small Gradio Space on the owner's own Hugging Face account, on ZeroGPU.

The brain (apps/edge/src/selftrain/pool.ts) makes this Space once, after the owner said yes in SYSTEM → OFFLINE BRAIN
TRAINING, and only on a free account with no card on file: a free account gets about 5 GPU-minutes a day and cannot buy
more, so nothing here can ever cost him money. It uploads this file, ghosty_weekly.py (the weekly notebook: the Space
uses its own code, DailyPool) and two secrets: HF_TOKEN (to read his PRIVATE repos at call time; nothing of his is kept
in the Space) and GHOSTY_KEY (every call must carry it: a public Space would still answer no one else).

Three calls (the Gradio API, `/gradio_api/call/<name>`), each with one JSON string and one JSON string back:
  sample — STaR candidates from the brain in use on today's slice of the week's puzzles (GPU, at most 4.5 minutes);
  score  — the GYM's exact checkers on them (CPU: no GPU time), the right ones as training records;
  exam   — a chunk of a SCHOOL paper's questions with the phone's exam prompt (GPU), when Kaggle's hours are short.
"""
import json
import os

import gradio as gr
import spaces

import ghosty_weekly as G

POOL = G.DailyPool(os.environ.get('HF_TOKEN', ''), os.environ.get('GHOSTY_KEY', ''))


def _seconds(prompts, n, temperature, max_new, seconds, quantised=False):
    return seconds


@spaces.GPU(duration=_seconds)
def _generate(prompts, n, temperature, max_new, seconds, quantised=False):
    # the GPU is lent for `seconds` (the brain's share of today's minutes); generate_now stops before they run out
    return POOL.generate_now(prompts, n, temperature, max_new, seconds, quantised)


def sample(args):
    return json.dumps(POOL.call('sample', args, _generate))


def score(args):
    return json.dumps(POOL.call('score', args))


def exam(args):
    return json.dumps(POOL.call('exam', args, _generate))


with gr.Blocks(title="Ghosty's daily GPU") as demo:
    gr.Markdown("Ghosty's daily GPU. Nothing to use here: Ghosty's brain calls it once a day, with its own key.")
    given = gr.Textbox(visible=False)
    answer = gr.Textbox(visible=False)
    for fn in (sample, score, exam):
        gr.Button(fn.__name__, visible=False).click(fn, given, answer, api_name=fn.__name__)

demo.queue(default_concurrency_limit=1).launch()
