# Jason's original framing (verbatim, 2026-08-13)

> Here are my thoughts:
>
> 1. We strip the AI work out of our current pre-processing that runs via a Vercel Sandbox,
> and we just keep the PDF processing and rasterization stuff in there. So you can still drag
> documents into a submission via the UI and have them get processed, but we end up with split
> PDFs and thumbnail images, but no summaries, block extraction etc - all of that latter stuff
> happens with AI SDK calls to Gemini today, and instead we'll leave those things blank and
> simply show the sheet thumbnails and let you flip through them, but there will be no sheet
> name, summary, blocks, etc. - same for supplementary docs where we'll just show the
> thumbnail and file name until we run the full agentic pre-processing, which will be a
> separate process done via runbook. There might still be a tiny bit of AI calls happening in
> the Vercel Sandbox once things are stripped out, but it would just be the part that figures
> out what to do with a zip file when it is uploaded, by looking at the contents. The thing we
> want to remove is all of the AI prompts that read the uploaded docs and summarize/transcribe
> them.
>
> 2. Next, we add a new runbook that is initiated via Claude Code interactive sessions, just
> like how we do the new review runbook or SIR runbook - it will pre-process a site plan, and
> since it is able to look at the full submission, with an Opus orchestrator, it will be able
> to take things in as a whole, and have the advantage of understanding that the legend for a
> diagram on one sheet might be on the prior sheet, or two sheets earlier, and it will be able
> to think about sheets in context of the whole - which is often most useful comparing a sheet
> against what is on the cover sheet. I don't think those sorts of cross-sheet explorations
> should be part of the golden path for processing, but when an agent has trouble finding a
> legend for instance, or needs more context, it could have the option to go explore other
> sheets to get questions answered. We should use a similar approach to how we process
> uploaded documents in the SIR runbook, with a two pass analysis that is then synthesized and
> any conflicts explored. The two passes are something like "content" and "meaning" I think,
> in the SIR runbook. They use Opus 5 and have instructions on how to zoom in to get high
> resolution on each portion of the sheet. When this runbook runs, it should "publish" its
> output to the same db fields we currently use, so it can be seen in the UI and used in site
> plan review the way we currently use it - the difference will be that we don't populate
> those fields on upload anymore, but rather we do it when this new runbook is run
> interactively. And one of the benefits of running it interactively is that we sometimes run
> into weird artifacts when processing PDFs - where the PDF gets garbled or corrupted when
> processing - this is less common now, but still occurs - or it might be that a plan set
> seems to be incomplete when uploaded - particularly when uploading a new submission version,
> where we might have sheets missing that had been in a prior version and we need the human to
> help determine if that was intentional or a mistake - or to go fix PDF processing bugs if we
> had those, and re-run the mechanical/automated part of pre-processing to get clean PDF and
> rasterized images. By having a human in the loop, the agent can escalate when things seem
> off, as opposed to what happens now which is either a silent failure or skipped processing.
>
> 3. Finally, when running a review runbook, we'll need to look to see if the submission
> version has already been pre-processed via the agentic pre-processing runbook - and if not,
> the review runbook should launch the pre-processing runbook as a separate step, a
> prerequisite for the review.
>
> The end result will be the mechanical/automated part of pre-processing happens via Vercel
> Sandbox just like it does today, but the agentic reasoning, summarization, block bounding
> box detection, and transcription all happens via a new runbook that we run via Claude Code
> sessions using our subscription tokens.

Additional directives from the same session:

> I want to ruthlessly simplify things - I do not want to add complexity. My hope is that by
> using a simple runbook and making the agentic part less mechanical, we will end up with a
> simpler process where the agent can use more reasoning to get the work done well.

And on ratification:

> I am aligned with the shape. I want Will to get to decide how to implement.

(Note: the SIR runbook's two passes are actually named "literal draftsman" and "meaning" —
Jason's "content"/"meaning" recollection was close; see `exploration-runbook-patterns.md`.)
