const PROPOSAL_MARKER = "\n[[POLARIS_INTERVIEW_PROPOSAL]]";

type InterviewProposal = {
  proposedDate: Date | null;
  proposalNote: string | null;
  alternativeSlots: Date[];
};

export function readInterviewProposal(notes: string | null): {
  notes: string | null;
  proposal: InterviewProposal;
} {
  const markerIndex = notes?.lastIndexOf(PROPOSAL_MARKER) ?? -1;
  if (!notes || markerIndex < 0) {
    return { notes, proposal: { proposedDate: null, proposalNote: null, alternativeSlots: [] } };
  }

  try {
    const stored = JSON.parse(notes.slice(markerIndex + PROPOSAL_MARKER.length)) as {
      proposedDate?: string;
      proposalNote?: string | null;
      alternativeSlots?: string[];
    };
    const proposedDate = stored.proposedDate ? new Date(stored.proposedDate) : null;
    return {
      notes: notes.slice(0, markerIndex).trim() || null,
      proposal: {
        proposedDate: proposedDate && Number.isFinite(proposedDate.getTime()) ? proposedDate : null,
        proposalNote: stored.proposalNote?.trim() || null,
        alternativeSlots: (stored.alternativeSlots ?? []).map((slot) => new Date(slot)).filter((slot) => Number.isFinite(slot.getTime())),
      },
    };
  } catch {
    return { notes, proposal: { proposedDate: null, proposalNote: null, alternativeSlots: [] } };
  }
}
export function writeInterviewProposal(
  notes: string | null,
  proposedDate: Date,
  proposalNote?: string,
) {
  const parsed = readInterviewProposal(notes);
  const current = parsed.notes ?? "";
  return `${current}${PROPOSAL_MARKER}${JSON.stringify({
    proposedDate: proposedDate.toISOString(),
    proposalNote: proposalNote?.trim() || null,
    alternativeSlots: parsed.proposal.alternativeSlots.map((slot) => slot.toISOString()),
  })}`;
}

export function writeInterviewAlternativeSlots(notes: string | null, alternativeSlots: Date[]) {
  const parsed = readInterviewProposal(notes);
  return `${parsed.notes ?? ""}${PROPOSAL_MARKER}${JSON.stringify({
    proposedDate: parsed.proposal.proposedDate?.toISOString() ?? null,
    proposalNote: parsed.proposal.proposalNote,
    alternativeSlots: alternativeSlots.map((slot) => slot.toISOString()),
  })}`;
}

export function writeInterviewNotes(existingNotes: string | null, notes: string | null) {
  const parsed = readInterviewProposal(existingNotes);
  const hasNegotiation = parsed.proposal.proposedDate || parsed.proposal.alternativeSlots.length;
  if (!hasNegotiation) return notes;
  return `${notes ?? ""}${PROPOSAL_MARKER}${JSON.stringify({
    proposedDate: parsed.proposal.proposedDate?.toISOString() ?? null,
    proposalNote: parsed.proposal.proposalNote,
    alternativeSlots: parsed.proposal.alternativeSlots.map((slot) => slot.toISOString()),
  })}`;
}
